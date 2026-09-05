import * as Y from "yjs";
import type { PeerConnectionManager } from "./peer-connection-manager";

const MESSAGE_KIND_YJS_UPDATE = 0;

/**
 * Keeps a Y.Doc in sync across every connected peer over the existing WebRTC data channels,
 * multiplexed with a one-byte kind tag so this can share a channel with other wire protocols
 * (e.g. the chunk swarm) later. On connect, a new peer receives the whole current state as one
 * update — simpler than negotiating state vectors, and fine at this project's scale since a
 * timeline's Yjs state stays small (kilobytes, not megabytes).
 */
export function attachCollabSync(doc: Y.Doc, manager: PeerConnectionManager): () => void {
  const onDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === "remote") return; // don't echo back updates we just applied from a peer
    manager.broadcast(encode(update));
  };
  doc.on("update", onDocUpdate);

  const offPeerConnected = manager.on("peer-connected", ({ peerId }) => {
    manager.send(peerId, encode(Y.encodeStateAsUpdate(doc)));
  });

  const offMessage = manager.on("message", ({ data }) => {
    const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : null;
    if (!bytes || bytes.length === 0 || bytes[0] !== MESSAGE_KIND_YJS_UPDATE) return;
    Y.applyUpdate(doc, bytes.subarray(1), "remote");
  });

  return () => {
    doc.off("update", onDocUpdate);
    offPeerConnected();
    offMessage();
  };
}

function encode(update: Uint8Array): ArrayBuffer {
  const out = new Uint8Array(update.length + 1);
  out[0] = MESSAGE_KIND_YJS_UPDATE;
  out.set(update, 1);
  return out.buffer;
}
