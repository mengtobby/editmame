import type { RTCPeerConnectionLike, WebSocketLike } from "../peer-connection-manager";

/**
 * In-memory stand-ins for WebSocket and RTCPeerConnection so PeerConnectionManager's
 * orchestration logic (initiator election, signaling relay, reconnection, event wiring) can be
 * exercised in vitest without a browser or real network. These fakes don't model SDP/ICE
 * semantics — they model the *shape* of the async handshake closely enough that the manager
 * code under test can't tell the difference.
 */

type Listener = (event: unknown) => void;

class FakeEventTarget {
  private listeners = new Map<string, Set<Listener>>();

  addEventListener(type: string, listener: Listener | null): void {
    if (!listener) return;
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener);
  }

  removeEventListener(type: string, listener: Listener | null): void {
    if (!listener) return;
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event: Event): boolean {
    const type = (event as unknown as { type: string }).type;
    const set = this.listeners.get(type);
    if (set) for (const listener of Array.from(set)) listener(event);
    return true;
  }

  /** Dispatches a plain-object stand-in for a DOM event; our listeners only ever read named
   *  fields off it (e.g. `.data`, `.channel`), never real Event/MessageEvent methods. */
  protected emit(type: string, extra: Record<string, unknown> = {}): void {
    this.dispatchEvent({ type, ...extra } as unknown as Event);
  }
}

// ---------------------------------------------------------------------------
// Signaling hub: relays "join" / "signal" messages between FakeWebSocket clients,
// mirroring server/signaling-server.ts's room semantics.
// ---------------------------------------------------------------------------

export class FakeSignalingHub {
  private clients = new Map<string, FakeWebSocket>();

  register(peerId: string, socket: FakeWebSocket): void {
    const existingIds = Array.from(this.clients.keys());
    this.clients.set(peerId, socket);
    socket.deliver({ type: "room-peers", peerIds: existingIds });
    for (const [otherId, otherSocket] of this.clients) {
      if (otherId !== peerId) otherSocket.deliver({ type: "peer-joined", peerId });
    }
  }

  unregister(peerId: string): void {
    this.clients.delete(peerId);
    for (const socket of this.clients.values()) socket.deliver({ type: "peer-left", peerId });
  }

  relay(fromPeerId: string, toPeerId: string, payload: unknown): void {
    this.clients.get(toPeerId)?.deliver({ type: "signal", fromPeerId, toPeerId, payload });
  }
}

export class FakeWebSocket extends FakeEventTarget implements WebSocketLike {
  readyState = 0; // CONNECTING
  private joinedPeerId: string | null = null;

  constructor(
    private readonly hub: FakeSignalingHub,
    autoOpen = true,
  ) {
    super();
    if (autoOpen) {
      queueMicrotask(() => {
        this.readyState = 1; // OPEN
        this.emit("open");
      });
    }
  }

  send(data: string): void {
    const message = JSON.parse(data);
    if (message.type === "join") {
      this.joinedPeerId = message.peerId;
      this.hub.register(message.peerId, this);
    } else if (message.type === "signal") {
      this.hub.relay(message.fromPeerId, message.toPeerId, message.payload);
    }
  }

  close(): void {
    this.readyState = 3; // CLOSED
    if (this.joinedPeerId) this.hub.unregister(this.joinedPeerId);
    this.emit("close");
  }

  /** Delivers a message as if it arrived from the server. */
  deliver(message: unknown): void {
    this.emit("message", { data: JSON.stringify(message) });
  }
}

// ---------------------------------------------------------------------------
// RTCPeerConnection fake: a "connected" handshake is simulated once the answerer
// processes the offer, sidestepping real SDP/ICE negotiation entirely.
// ---------------------------------------------------------------------------

export class FakeDataChannel extends FakeEventTarget {
  readyState: RTCDataChannelState = "connecting";
  binaryType: BinaryType = "blob";
  private remote: FakeDataChannel | null = null;

  constructor(readonly label: string) {
    super();
  }

  linkTo(remote: FakeDataChannel): void {
    this.remote = remote;
  }

  open(): void {
    this.readyState = "open";
    this.emit("open");
  }

  send(data: unknown): void {
    this.remote?.emit("message", { data });
  }

  close(): void {
    this.readyState = "closed";
    this.emit("close");
  }
}

export class FakeRTCNetwork {
  private pendingOffers = new Map<string, FakeDataChannel[]>();

  createFactory(localPeerId: string): (config: RTCConfiguration) => RTCPeerConnectionLike {
    return () => new FakeRTCPeerConnection(localPeerId, this);
  }

  registerOfferChannel(fromPeerId: string, channel: FakeDataChannel): void {
    const queue = this.pendingOffers.get(fromPeerId) ?? [];
    queue.push(channel);
    this.pendingOffers.set(fromPeerId, queue);
  }

  /** Called by the answerer's connection once it processes an offer tagged with the offerer's id. */
  completeHandshake(offererId: string, answererConnection: FakeRTCPeerConnection): void {
    const offererChannel = this.pendingOffers.get(offererId)?.shift();
    if (!offererChannel) return;

    const answererChannel = new FakeDataChannel(offererChannel.label);
    offererChannel.linkTo(answererChannel);
    answererChannel.linkTo(offererChannel);

    answererConnection.connectionState = "connected";
    answererConnection.emitConnectionStateChange();
    answererConnection.emitDataChannel(answererChannel);

    queueMicrotask(() => {
      offererChannel.open();
      answererChannel.open();
    });
  }

  markOffererConnected(offererConnection: FakeRTCPeerConnection): void {
    offererConnection.connectionState = "connected";
    offererConnection.emitConnectionStateChange();
  }
}

export class FakeRTCPeerConnection extends FakeEventTarget implements RTCPeerConnectionLike {
  connectionState: RTCPeerConnectionState = "new";

  constructor(
    private readonly localPeerId: string,
    private readonly network: FakeRTCNetwork,
  ) {
    super();
  }

  createDataChannel(label: string): RTCDataChannel {
    const channel = new FakeDataChannel(label);
    this.network.registerOfferChannel(this.localPeerId, channel);
    return channel as unknown as RTCDataChannel;
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    return { type: "offer", sdp: `offer:${this.localPeerId}` };
  }

  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    return { type: "answer", sdp: `answer:${this.localPeerId}` };
  }

  async setLocalDescription(description?: RTCSessionDescriptionInit): Promise<void> {
    if (description?.type === "offer") {
      // The offerer's side finishes "connecting" once the answerer completes the handshake;
      // nothing to do here beyond letting the offer flow to signaling.
    }
  }

  async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    if (description.type === "offer" && description.sdp) {
      const offererId = description.sdp.split(":")[1];
      if (offererId) this.network.completeHandshake(offererId, this);
    } else if (description.type === "answer" && description.sdp) {
      const answererId = description.sdp.split(":")[1];
      if (answererId) this.network.markOffererConnected(this);
    }
  }

  async addIceCandidate(): Promise<void> {
    // No-op: this fake never emits icecandidate events, so nothing to add.
  }

  close(): void {
    this.connectionState = "closed";
  }

  emitConnectionStateChange(): void {
    this.emit("connectionstatechange");
  }

  emitDataChannel(channel: FakeDataChannel): void {
    this.emit("datachannel", { channel });
  }
}
