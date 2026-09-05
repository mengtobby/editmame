import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

describe("PeerConnectionManager", () => {
  let hub: FakeSignalingHub;
  let rtcNetwork: FakeRTCNetwork;

  beforeEach(() => {
    hub = new FakeSignalingHub();
    rtcNetwork = new FakeRTCNetwork();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function makeManager(peerId: string): PeerConnectionManager {
    return new PeerConnectionManager({
      signalingUrl: "ws://fake",
      roomId: "room-1",
      peerId,
      createWebSocket: () => new FakeWebSocket(hub),
      createPeerConnection: rtcNetwork.createFactory(peerId),
    });
  }

  it("elects the lexicographically-smaller peerId as initiator and opens a data channel both ways", async () => {
    const a = makeManager("peer-a");
    const b = makeManager("peer-b");

    const connectedOnA: string[] = [];
    const connectedOnB: string[] = [];
    a.on("peer-connected", ({ peerId }) => connectedOnA.push(peerId));
    b.on("peer-connected", ({ peerId }) => connectedOnB.push(peerId));

    a.connect();
    b.connect();

    await waitFor(() => connectedOnA.includes("peer-b") && connectedOnB.includes("peer-a"));

    expect(a.getConnectedPeerIds()).toEqual(["peer-b"]);
    expect(b.getConnectedPeerIds()).toEqual(["peer-a"]);
  });

  it("delivers messages sent from one peer to the other over the data channel", async () => {
    const a = makeManager("peer-a");
    const b = makeManager("peer-b");

    const received: Array<string | ArrayBuffer> = [];
    b.on("message", ({ data }) => received.push(data));

    a.connect();
    b.connect();

    await waitFor(() => a.getConnectedPeerIds().includes("peer-b"));
    a.send("peer-b", "hello from a");

    await waitFor(() => received.length > 0);
    expect(received).toEqual(["hello from a"]);
  });

  it("removes a peer and emits peer-disconnected when the signaling server reports it left", async () => {
    const a = makeManager("peer-a");
    const b = makeManager("peer-b");

    a.connect();
    b.connect();
    await waitFor(() => a.getConnectedPeerIds().includes("peer-b"));

    const disconnected: string[] = [];
    a.on("peer-disconnected", ({ peerId }) => disconnected.push(peerId));

    b.destroy();
    await waitFor(() => disconnected.includes("peer-b"));
    expect(a.getConnectedPeerIds()).toEqual([]);
  });

  it("reconnects the signaling socket with exponential backoff after an unexpected close", async () => {
    vi.useFakeTimers();
    let createCount = 0;
    let lastSocket: FakeWebSocket | null = null;

    const manager = new PeerConnectionManager({
      signalingUrl: "ws://fake",
      roomId: "room-1",
      peerId: "peer-a",
      reconnectBaseDelayMs: 100,
      reconnectMaxDelayMs: 1000,
      createWebSocket: () => {
        createCount += 1;
        lastSocket = new FakeWebSocket(hub, false);
        return lastSocket;
      },
      createPeerConnection: rtcNetwork.createFactory("peer-a"),
    });

    const states: string[] = [];
    manager.on("signaling-state", ({ state }) => states.push(state));

    manager.connect();
    expect(createCount).toBe(1);

    // Simulate the socket dropping unexpectedly.
    lastSocket!.close();
    expect(states.at(-1)).toBe("reconnecting");
    expect(createCount).toBe(1);

    await vi.advanceTimersByTimeAsync(100);
    expect(createCount).toBe(2);

    lastSocket!.close();
    await vi.advanceTimersByTimeAsync(100);
    expect(createCount).toBe(2); // backoff doubled to 200ms, not yet due

    await vi.advanceTimersByTimeAsync(100);
    expect(createCount).toBe(3);

    manager.destroy();
  });
});
