import { describe, expect, it, vi } from "vitest";
import { ChunkScheduler } from "./chunk-scheduler";
import type { ChunkRequestCandidate } from "@/types/wire-protocol";

function candidate(overrides: Partial<ChunkRequestCandidate> = {}): ChunkRequestCandidate {
  return {
    assetHash: "asset-1",
    chunkIndex: 0,
    deadlineUs: 1_000_000,
    candidatePeerIds: ["peer-a"],
    ...overrides,
  };
}

describe("ChunkScheduler", () => {
  it("requests the most urgent (soonest-deadline) chunk first", () => {
    const requested: number[] = [];
    const scheduler = new ChunkScheduler({
      requestChunk: (_peer, _asset, chunkIndex) => requested.push(chunkIndex),
      cancelChunk: () => {},
    });

    scheduler.schedule([
      candidate({ chunkIndex: 2, deadlineUs: 5_000_000 }),
      candidate({ chunkIndex: 0, deadlineUs: 500_000 }),
      candidate({ chunkIndex: 1, deadlineUs: 2_000_000 }),
    ]);

    expect(requested).toEqual([0, 1, 2]);
  });

  it("never issues two outstanding requests for the same chunk", () => {
    let calls = 0;
    const scheduler = new ChunkScheduler({
      requestChunk: () => {
        calls += 1;
      },
      cancelChunk: () => {},
    });

    scheduler.schedule([candidate()]);
    scheduler.schedule([candidate()]);

    expect(calls).toBe(1);
    expect(scheduler.getInFlightCount()).toBe(1);
  });

  it("respects maxInFlightPerPeer by skipping an over-loaded peer", () => {
    const requestedPeers: string[] = [];
    const scheduler = new ChunkScheduler(
      {
        requestChunk: (peerId) => requestedPeers.push(peerId),
        cancelChunk: () => {},
      },
      { maxInFlightPerPeer: 1 },
    );

    scheduler.schedule([
      candidate({ chunkIndex: 0, candidatePeerIds: ["peer-a"] }),
      candidate({ chunkIndex: 1, candidatePeerIds: ["peer-a"] }),
    ]);

    // Only the first chunk can be requested from peer-a; the second has nowhere to go.
    expect(requestedPeers).toEqual(["peer-a"]);
    expect(scheduler.getInFlightCount()).toBe(1);
  });

  it("picks the least-busy of several candidate peers", () => {
    const requestedPeers: string[] = [];
    const scheduler = new ChunkScheduler(
      {
        requestChunk: (peerId) => requestedPeers.push(peerId),
        cancelChunk: () => {},
      },
      { maxInFlightPerPeer: 5 },
    );

    scheduler.schedule([candidate({ chunkIndex: 0, candidatePeerIds: ["peer-a"] })]);
    scheduler.schedule([candidate({ chunkIndex: 1, candidatePeerIds: ["peer-a", "peer-b"] })]);

    expect(requestedPeers).toEqual(["peer-a", "peer-b"]);
  });

  it("clears in-flight state once a chunk is received, allowing re-scheduling", () => {
    let calls = 0;
    const scheduler = new ChunkScheduler({
      requestChunk: () => {
        calls += 1;
      },
      cancelChunk: () => {},
    });

    scheduler.schedule([candidate()]);
    scheduler.onChunkReceived("asset-1", 0);
    expect(scheduler.getInFlightCount()).toBe(0);

    scheduler.schedule([candidate()]);
    expect(calls).toBe(2);
  });

  it("times out a stalled request, cancels it, and re-requests on the next schedule", () => {
    let now = 0;
    let cancelCalls = 0;
    let requestCalls = 0;
    const scheduler = new ChunkScheduler(
      {
        requestChunk: () => {
          requestCalls += 1;
        },
        cancelChunk: () => {
          cancelCalls += 1;
        },
        now: () => now,
      },
      { requestTimeoutMs: 1000 },
    );

    scheduler.schedule([candidate()]);
    expect(requestCalls).toBe(1);

    now = 1500;
    scheduler.schedule([candidate()]);

    expect(cancelCalls).toBe(1);
    expect(requestCalls).toBe(2);
  });

  it("skips candidates with no known holders", () => {
    const scheduler = new ChunkScheduler({
      requestChunk: vi.fn(),
      cancelChunk: vi.fn(),
    });

    scheduler.schedule([candidate({ candidatePeerIds: [] })]);
    expect(scheduler.getInFlightCount()).toBe(0);
  });
});
