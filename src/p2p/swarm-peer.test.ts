import { describe, expect, it } from "vitest";
import { chunkFile } from "@/media/chunker";
import { InMemoryChunkStore } from "@/storage/chunk-store";
import { PeerConnectionManager } from "./peer-connection-manager";
import { SwarmPeer } from "./swarm-peer";
import { FakeRTCNetwork, FakeSignalingHub, FakeWebSocket } from "./test-utils/fake-network";
import { CHUNK_SIZE_BYTES } from "@/types/wire-protocol";

function waitFor(predicate: () => boolean | Promise<boolean>, timeoutMs = 1000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = async () => {
      if (await predicate()) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error("waitFor timed out"));
      setTimeout(tick, 1);
    };
    void tick();
  });
}

function randomBytes(size: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(size);
  for (let i = 0; i < size; i += 1) bytes[i] = (i * 2654435761) % 256;
  return bytes;
}

describe("SwarmPeer end-to-end chunk transfer", () => {
  it("delivers every chunk of an announced asset to a peer that has none of it", async () => {
    const hub = new FakeSignalingHub();
    const rtcNetwork = new FakeRTCNetwork();

    const storeA = new InMemoryChunkStore();
    const storeB = new InMemoryChunkStore();
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

    const swarmA = new SwarmPeer(managerA, storeA);
    const swarmB = new SwarmPeer(managerB, storeB);

    // peer-a imports a file and populates its own store, as the UI import flow would.
    const fileBytes = randomBytes(CHUNK_SIZE_BYTES * 2 + 500);
    const { manifest, chunks } = await chunkFile(new Blob([fileBytes]), "clip.mp4");
    for (let i = 0; i < chunks.length; i += 1) {
      await storeA.putChunk(manifest.assetHash, i, chunks[i]!);
    }

    let updatedAssetHash: string | null = null;
    swarmB.onAssetUpdated = (assetHash) => {
      updatedAssetHash = assetHash;
    };

    managerA.connect();
    managerB.connect();
    await waitFor(() => managerA.getConnectedPeerIds().includes("peer-b"));

    await swarmA.announceLocalAsset(manifest);

    await waitFor(async () => {
      for (let i = 0; i < manifest.chunkCount; i += 1) {
        if (!(await storeB.hasChunk(manifest.assetHash, i))) return false;
      }
      return true;
    }, 2000);

    for (let i = 0; i < manifest.chunkCount; i += 1) {
      const received = await storeB.getChunk(manifest.assetHash, i);
      expect(received).toEqual(chunks[i]);
    }
    expect(updatedAssetHash).toBe(manifest.assetHash);

    swarmA.dispose();
    swarmB.dispose();
  });

  it("catches up a peer who joins after the asset was already announced to others", async () => {
    const hub = new FakeSignalingHub();
    const rtcNetwork = new FakeRTCNetwork();

    const storeA = new InMemoryChunkStore();
    const storeB = new InMemoryChunkStore();
    const managerA = new PeerConnectionManager({
      signalingUrl: "ws://fake",
      roomId: "room-1",
      peerId: "peer-a",
      createWebSocket: () => new FakeWebSocket(hub),
      createPeerConnection: rtcNetwork.createFactory("peer-a"),
    });
    const swarmA = new SwarmPeer(managerA, storeA);

    const fileBytes = randomBytes(1500);
    const { manifest, chunks } = await chunkFile(new Blob([fileBytes]), "clip.mp4");
    await storeA.putChunk(manifest.assetHash, 0, chunks[0]!);

    // Announce with nobody else in the room yet — the broadcasts land on no one.
    await swarmA.announceLocalAsset(manifest);

    // peer-b joins well after that announcement; it must learn about the asset purely from the
    // peer-connected catch-up path (ManifestAnnounce + BitfieldUpdate sent directly to it).
    const managerB = new PeerConnectionManager({
      signalingUrl: "ws://fake",
      roomId: "room-1",
      peerId: "peer-b",
      createWebSocket: () => new FakeWebSocket(hub),
      createPeerConnection: rtcNetwork.createFactory("peer-b"),
    });
    const swarmB = new SwarmPeer(managerB, storeB);

    managerA.connect();
    managerB.connect();

    await waitFor(() => storeB.hasChunk(manifest.assetHash, 0));
    expect(await storeB.getChunk(manifest.assetHash, 0)).toEqual(chunks[0]);

    swarmA.dispose();
    swarmB.dispose();
  });

  it("rejects a chunk whose bytes don't match the claimed hash", async () => {
    const hub = new FakeSignalingHub();
    const rtcNetwork = new FakeRTCNetwork();
    const store = new InMemoryChunkStore();
    const manager = new PeerConnectionManager({
      signalingUrl: "ws://fake",
      roomId: "room-1",
      peerId: "peer-a",
      createWebSocket: () => new FakeWebSocket(hub),
      createPeerConnection: rtcNetwork.createFactory("peer-a"),
    });
    const swarm = new SwarmPeer(manager, store);

    // Directly feed a forged Chunk message as if it arrived from a malicious peer.
    const { encodeSwarmMessage } = await import("./swarm-codec");
    const { SwarmMessageType } = await import("@/types/wire-protocol");
    const forged = encodeSwarmMessage({
      type: SwarmMessageType.Chunk,
      assetHash: "deadbeef",
      chunkIndex: 0,
      requestId: "req-1",
      data: new Uint8Array([1, 2, 3]),
      hash: "not-the-real-hash",
    });

    manager.connect();
    // Reaching into private state to simulate an inbound message for this test.
    (manager as unknown as { emitter: { emit: (event: string, payload: unknown) => void } }).emitter.emit(
      "message",
      { peerId: "peer-evil", data: forged },
    );

    await new Promise((r) => setTimeout(r, 50));
    expect(await store.hasChunk("deadbeef", 0)).toBe(false);
    swarm.dispose();
  });
});
