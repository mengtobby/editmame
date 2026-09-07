import type { RTCSignalPayload, SignalingMessage } from "@/types/wire-protocol";
import { Emitter } from "./emitter";

export type ConnectionState = "new" | "connecting" | "connected" | "disconnected" | "failed" | "closed";
export type SignalingState = "connecting" | "open" | "reconnecting" | "closed";

/** Subset of the WebSocket interface we depend on, so tests can inject a fake transport. */
export interface WebSocketLike extends EventTarget {
  readonly readyState: number;
  send(data: string): void;
  close(): void;
}

/** Subset of RTCPeerConnection we depend on, so tests can inject a fake without real WebRTC. */
export interface RTCPeerConnectionLike extends EventTarget {
  readonly connectionState: RTCPeerConnectionState;
  createDataChannel(label: string): RTCDataChannel;
  createOffer(options?: RTCOfferOptions): Promise<RTCSessionDescriptionInit>;
  createAnswer(options?: RTCAnswerOptions): Promise<RTCSessionDescriptionInit>;
  setLocalDescription(description?: RTCSessionDescriptionInit): Promise<void>;
  setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void>;
  addIceCandidate(candidate: RTCIceCandidateInit): Promise<void>;
  close(): void;
}

export interface PeerHandle {
  peerId: string;
  connection: RTCPeerConnectionLike;
  dataChannel: RTCDataChannel | null;
  state: ConnectionState;
}

export interface PeerConnectionManagerEvents {
  "signaling-state": { state: SignalingState };
  "peer-connection-state": { peerId: string; state: ConnectionState };
  "peer-connected": { peerId: string };
  "peer-disconnected": { peerId: string };
  message: { peerId: string; data: string | ArrayBuffer };
  "bytes-sent": { peerId: string; bytes: number };
  "bytes-received": { peerId: string; bytes: number };
}

function byteLengthOf(data: string | ArrayBufferView | ArrayBuffer): number {
  if (typeof data === "string") return new TextEncoder().encode(data).length;
  return "byteLength" in data ? data.byteLength : 0;
}

export interface PeerConnectionManagerOptions {
  signalingUrl: string;
  roomId: string;
  peerId: string;
  iceServers?: RTCIceServer[];
  createWebSocket?: (url: string) => WebSocketLike;
  createPeerConnection?: (config: RTCConfiguration) => RTCPeerConnectionLike;
  reconnectBaseDelayMs?: number;
  reconnectMaxDelayMs?: number;
}

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

/**
 * Owns the WebSocket signaling connection and one RTCPeerConnection per remote peer.
 *
 * Initiator election is deterministic and needs no coordination: given a pair of peers, the one
 * with the lexicographically smaller peerId always creates the offer and the DataChannel. That
 * means both room-peers (existing members) and peer-joined (new arrivals) can run through the
 * exact same "ensure connection, offer if initiator" path without a glare-avoidance handshake.
 */
export class PeerConnectionManager {
  private readonly emitter = new Emitter<PeerConnectionManagerEvents>();
  private readonly peers = new Map<string, PeerHandle>();
  private readonly createWebSocket: (url: string) => WebSocketLike;
  private readonly createPeerConnection: (config: RTCConfiguration) => RTCPeerConnectionLike;
  private readonly iceServers: RTCIceServer[];
  private readonly reconnectBaseDelayMs: number;
  private readonly reconnectMaxDelayMs: number;

  private ws: WebSocketLike | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  constructor(private readonly options: PeerConnectionManagerOptions) {
    this.createWebSocket = options.createWebSocket ?? ((url) => new WebSocket(url) as unknown as WebSocketLike);
    this.createPeerConnection =
      options.createPeerConnection ?? ((config) => new RTCPeerConnection(config) as unknown as RTCPeerConnectionLike);
    this.iceServers = options.iceServers ?? DEFAULT_ICE_SERVERS;
    this.reconnectBaseDelayMs = options.reconnectBaseDelayMs ?? 500;
    this.reconnectMaxDelayMs = options.reconnectMaxDelayMs ?? 15_000;
  }

  on<K extends keyof PeerConnectionManagerEvents>(
    event: K,
    listener: (payload: PeerConnectionManagerEvents[K]) => void,
  ): () => void {
    return this.emitter.on(event, listener);
  }

  connect(): void {
    this.destroyed = false;
    this.emitter.emit("signaling-state", { state: "connecting" });

    const ws = this.createWebSocket(this.options.signalingUrl);
    this.ws = ws;

    ws.addEventListener("open", () => {
      this.reconnectAttempt = 0;
      this.emitter.emit("signaling-state", { state: "open" });
      this.sendToServer({ type: "join", roomId: this.options.roomId, peerId: this.options.peerId });
    });

    ws.addEventListener("message", (event) => {
      const raw = (event as MessageEvent).data;
      this.handleSignalingMessage(typeof raw === "string" ? raw : String(raw));
    });

    ws.addEventListener("close", () => {
      if (this.destroyed) {
        this.emitter.emit("signaling-state", { state: "closed" });
        return;
      }
      this.emitter.emit("signaling-state", { state: "reconnecting" });
      this.scheduleReconnect();
    });

    ws.addEventListener("error", () => {
      // The subsequent 'close' event drives reconnection; nothing further to do here.
    });
  }

  destroy(): void {
    this.destroyed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    for (const peerId of Array.from(this.peers.keys())) {
      this.closePeer(peerId);
    }
    this.emitter.clear();
  }

  send(peerId: string, data: string | ArrayBufferView | ArrayBuffer): void {
    const channel = this.peers.get(peerId)?.dataChannel;
    if (channel?.readyState === "open") {
      channel.send(data as never);
      this.emitter.emit("bytes-sent", { peerId, bytes: byteLengthOf(data) });
    }
  }

  broadcast(data: string | ArrayBufferView | ArrayBuffer): void {
    for (const peerId of this.peers.keys()) {
      this.send(peerId, data);
    }
  }

  getConnectedPeerIds(): string[] {
    return Array.from(this.peers.values())
      .filter((p) => p.dataChannel?.readyState === "open")
      .map((p) => p.peerId);
  }

  // ---- internals ----

  private scheduleReconnect(): void {
    const delay = Math.min(
      this.reconnectBaseDelayMs * 2 ** this.reconnectAttempt,
      this.reconnectMaxDelayMs,
    );
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      if (!this.destroyed) this.connect();
    }, delay);
  }

  private sendToServer(message: SignalingMessage): void {
    if (this.ws && this.ws.readyState === 1 /* OPEN */) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private sendSignal(toPeerId: string, payload: RTCSignalPayload): void {
    this.sendToServer({ type: "signal", fromPeerId: this.options.peerId, toPeerId, payload });
  }

  private isInitiatorFor(remotePeerId: string): boolean {
    return this.options.peerId < remotePeerId;
  }

  private handleSignalingMessage(raw: string): void {
    let message: SignalingMessage;
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }

    switch (message.type) {
      case "room-peers":
        for (const remotePeerId of message.peerIds) this.onPeerKnown(remotePeerId);
        break;
      case "peer-joined":
        this.onPeerKnown(message.peerId);
        break;
      case "peer-left":
        this.closePeer(message.peerId);
        break;
      case "signal":
        void this.handleSignal(message.fromPeerId, message.payload);
        break;
      default:
        break;
    }
  }

  private onPeerKnown(remotePeerId: string): void {
    const handle = this.ensurePeer(remotePeerId);
    if (this.isInitiatorFor(remotePeerId)) {
      void this.initiateOffer(handle);
    }
  }

  private ensurePeer(remotePeerId: string): PeerHandle {
    const existing = this.peers.get(remotePeerId);
    if (existing) return existing;

    const connection = this.createPeerConnection({ iceServers: this.iceServers });
    const handle: PeerHandle = { peerId: remotePeerId, connection, dataChannel: null, state: "new" };
    this.peers.set(remotePeerId, handle);

    connection.addEventListener("icecandidate", (event) => {
      const candidate = (event as RTCPeerConnectionIceEvent).candidate;
      if (candidate) this.sendSignal(remotePeerId, { kind: "ice-candidate", candidate: candidate.toJSON() });
    });

    connection.addEventListener("connectionstatechange", () => {
      const state = connection.connectionState as ConnectionState;
      handle.state = state;
      this.emitter.emit("peer-connection-state", { peerId: remotePeerId, state });
      if (state === "failed") void this.attemptIceRestart(handle);
    });

    connection.addEventListener("datachannel", (event) => {
      this.wireDataChannel(handle, (event as RTCDataChannelEvent).channel);
    });

    return handle;
  }

  private async initiateOffer(handle: PeerHandle): Promise<void> {
    const channel = handle.connection.createDataChannel("editmame");
    this.wireDataChannel(handle, channel);

    const offer = await handle.connection.createOffer();
    await handle.connection.setLocalDescription(offer);
    if (offer.sdp) this.sendSignal(handle.peerId, { kind: "offer", sdp: offer.sdp });
  }

  private async handleSignal(fromPeerId: string, payload: RTCSignalPayload): Promise<void> {
    const handle = this.ensurePeer(fromPeerId);

    if (payload.kind === "offer") {
      await handle.connection.setRemoteDescription({ type: "offer", sdp: payload.sdp });
      const answer = await handle.connection.createAnswer();
      await handle.connection.setLocalDescription(answer);
      if (answer.sdp) this.sendSignal(fromPeerId, { kind: "answer", sdp: answer.sdp });
    } else if (payload.kind === "answer") {
      await handle.connection.setRemoteDescription({ type: "answer", sdp: payload.sdp });
    } else {
      await handle.connection.addIceCandidate(payload.candidate);
    }
  }

  private async attemptIceRestart(handle: PeerHandle): Promise<void> {
    if (!this.isInitiatorFor(handle.peerId)) return;
    const offer = await handle.connection.createOffer({ iceRestart: true });
    await handle.connection.setLocalDescription(offer);
    if (offer.sdp) this.sendSignal(handle.peerId, { kind: "offer", sdp: offer.sdp });
  }

  private wireDataChannel(handle: PeerHandle, channel: RTCDataChannel): void {
    handle.dataChannel = channel;
    channel.binaryType = "arraybuffer";
    channel.addEventListener("open", () => this.emitter.emit("peer-connected", { peerId: handle.peerId }));
    channel.addEventListener("close", () => this.emitter.emit("peer-disconnected", { peerId: handle.peerId }));
    channel.addEventListener("message", (event) => {
      const data = (event as MessageEvent).data;
      this.emitter.emit("message", { peerId: handle.peerId, data });
      this.emitter.emit("bytes-received", { peerId: handle.peerId, bytes: byteLengthOf(data) });
    });
  }

  private closePeer(peerId: string): void {
    const handle = this.peers.get(peerId);
    if (!handle) return;
    handle.connection.close();
    this.peers.delete(peerId);
    this.emitter.emit("peer-disconnected", { peerId });
  }
}
