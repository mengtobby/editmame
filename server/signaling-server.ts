import { pathToFileURL } from "node:url";
import { WebSocketServer, type WebSocket } from "ws";
import type { SignalingMessage } from "../src/types/wire-protocol";

/**
 * Minimal signaling relay: exchanges SDP offers/answers and ICE candidates so peers can
 * establish direct WebRTC DataChannels. It never sees media, chunk data, or CRDT state — once
 * a DataChannel is open, this server is no longer in the path for that pair.
 */

const PORT = Number(process.env.PORT ?? 8787);
const HEARTBEAT_INTERVAL_MS = 30_000;

interface ConnectedPeer {
  ws: WebSocket;
  peerId: string;
  roomId: string;
  isAlive: boolean;
}

const rooms = new Map<string, Map<string, ConnectedPeer>>();

function roomOf(roomId: string): Map<string, ConnectedPeer> {
  let room = rooms.get(roomId);
  if (!room) {
    room = new Map();
    rooms.set(roomId, room);
  }
  return room;
}

function send(peer: ConnectedPeer, message: SignalingMessage): void {
  if (peer.ws.readyState === peer.ws.OPEN) {
    peer.ws.send(JSON.stringify(message));
  }
}

function broadcast(room: Map<string, ConnectedPeer>, message: SignalingMessage, exceptPeerId?: string): void {
  for (const peer of room.values()) {
    if (peer.peerId !== exceptPeerId) send(peer, message);
  }
}

function isValidId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 128;
}

function handleMessage(peer: ConnectedPeer | null, raw: string, socket: WebSocket): ConnectedPeer | null {
  let message: SignalingMessage;
  try {
    message = JSON.parse(raw);
  } catch {
    socket.send(JSON.stringify({ type: "error", message: "invalid JSON" } satisfies SignalingMessage));
    return peer;
  }

  if (message.type === "join") {
    if (!isValidId(message.roomId) || !isValidId(message.peerId)) {
      socket.send(JSON.stringify({ type: "error", message: "invalid join payload" } satisfies SignalingMessage));
      return peer;
    }
    const room = roomOf(message.roomId);
    if (room.has(message.peerId)) {
      socket.send(JSON.stringify({ type: "error", message: "peerId already in room" } satisfies SignalingMessage));
      return peer;
    }

    const existingPeerIds = Array.from(room.keys());
    const newPeer: ConnectedPeer = { ws: socket, peerId: message.peerId, roomId: message.roomId, isAlive: true };
    room.set(message.peerId, newPeer);

    send(newPeer, { type: "room-peers", peerIds: existingPeerIds });
    broadcast(room, { type: "peer-joined", peerId: message.peerId }, message.peerId);
    return newPeer;
  }

  if (!peer) {
    socket.send(JSON.stringify({ type: "error", message: "must join a room before signaling" } satisfies SignalingMessage));
    return peer;
  }

  if (message.type === "signal") {
    if (!isValidId(message.toPeerId)) return peer;
    const room = roomOf(peer.roomId);
    const target = room.get(message.toPeerId);
    if (target) {
      send(target, { ...message, fromPeerId: peer.peerId });
    }
    return peer;
  }

  return peer;
}

function removePeer(peer: ConnectedPeer): void {
  const room = rooms.get(peer.roomId);
  if (!room) return;
  room.delete(peer.peerId);
  broadcast(room, { type: "peer-left", peerId: peer.peerId });
  if (room.size === 0) rooms.delete(peer.roomId);
}

export function startSignalingServer(port = PORT): WebSocketServer {
  const wss = new WebSocketServer({ port });

  wss.on("connection", (socket) => {
    let peer: ConnectedPeer | null = null;

    socket.on("pong", () => {
      if (peer) peer.isAlive = true;
    });

    socket.on("message", (data) => {
      peer = handleMessage(peer, data.toString(), socket);
    });

    socket.on("close", () => {
      if (peer) removePeer(peer);
    });

    socket.on("error", () => {
      if (peer) removePeer(peer);
    });
  });

  const heartbeat = setInterval(() => {
    for (const room of rooms.values()) {
      for (const peer of room.values()) {
        if (!peer.isAlive) {
          peer.ws.terminate();
          continue;
        }
        peer.isAlive = false;
        peer.ws.ping();
      }
    }
  }, HEARTBEAT_INTERVAL_MS);

  wss.on("close", () => clearInterval(heartbeat));

  process.stdout.write(`[loomp2p] signaling server listening on ws://localhost:${port}\n`);
  return wss;
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  startSignalingServer();
}
