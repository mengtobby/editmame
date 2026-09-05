import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { attachCollabSync } from "./collab-sync";
import { PeerConnectionManager } from "./peer-connection-manager";
import { FakeRTCNetwork, FakeSignalingHub, FakeWebSocket } from "./test-utils/fake-network";

function waitFor(predicate: () => boolean, timeoutMs = 1000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (predicate()) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error("waitFor timed out"));
      setTimeout(tick, 1);
    };
    tick();
  });
}

describe("attachCollabSync", () => {
  it("propagates local edits to a peer that was already connected", async () => {
    const hub = new FakeSignalingHub();
    const rtcNetwork = new FakeRTCNetwork();

    const docA = new Y.Doc();
    const docB = new Y.Doc();
    const managerA = new PeerConnectionManager({
      signalingUrl: "ws://fake",
      roomId: "room-1",
      peerId: "peer-a",
      createWebSocket: () => new FakeWebSocket(hub),
      createPeerConnection: rtcNetwork.createFactory("peer-a"),
    });
    const managerB = new PeerConnectionManager({
      signalingUrl: "ws://fake",
      roomId: "room-1",
      peerId: "peer-b",
      createWebSocket: () => new FakeWebSocket(hub),
      createPeerConnection: rtcNetwork.createFactory("peer-b"),
    });

    attachCollabSync(docA, managerA);
    attachCollabSync(docB, managerB);

    managerA.connect();
    managerB.connect();
    await waitFor(() => managerA.getConnectedPeerIds().includes("peer-b"));

    docA.getMap("tracks").set("track-1", new Y.Map());
    await waitFor(() => docB.getMap("tracks").has("track-1"));

    expect(docB.getMap("tracks").has("track-1")).toBe(true);
  });

  it("brings a newly-connected peer up to date with existing state", async () => {
    const hub = new FakeSignalingHub();
    const rtcNetwork = new FakeRTCNetwork();

    const docA = new Y.Doc();
    docA.getMap("tracks").set("track-1", new Y.Map());

    const docB = new Y.Doc();
    const managerA = new PeerConnectionManager({
      signalingUrl: "ws://fake",
      roomId: "room-1",
      peerId: "peer-a",
      createWebSocket: () => new FakeWebSocket(hub),
      createPeerConnection: rtcNetwork.createFactory("peer-a"),
    });
    const managerB = new PeerConnectionManager({
      signalingUrl: "ws://fake",
      roomId: "room-1",
      peerId: "peer-b",
      createWebSocket: () => new FakeWebSocket(hub),
      createPeerConnection: rtcNetwork.createFactory("peer-b"),
    });

    attachCollabSync(docA, managerA);
    attachCollabSync(docB, managerB);

    // peer-b joins after peer-a already has state.
    managerA.connect();
    managerB.connect();

    await waitFor(() => docB.getMap("tracks").has("track-1"));
    expect(docB.getMap("tracks").has("track-1")).toBe(true);
  });
});
