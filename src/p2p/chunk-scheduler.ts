import type { ChunkRequestCandidate, InFlightRequest } from "@/types/wire-protocol";

export interface ChunkSchedulerOptions {
  /** Concurrent outstanding requests allowed to a single peer. */
  maxInFlightPerPeer?: number;
  /** Concurrent outstanding requests allowed in total. */
  maxGlobalInFlight?: number;
  /** How long to wait for a chunk before cancelling and letting it be re-requested. */
  requestTimeoutMs?: number;
}

export interface ChunkSchedulerDeps {
  requestChunk(peerId: string, assetHash: string, chunkIndex: number, priority: number, requestId: string): void;
  cancelChunk(peerId: string, assetHash: string, chunkIndex: number, requestId: string): void;
  now?: () => number;
}

/**
 * Turns a list of "this chunk is missing and needed by time T" candidates into actual
 * RequestChunk sends, respecting per-peer/global concurrency limits and retrying chunks whose
 * request timed out. Deliberately has no knowledge of the timeline or playhead — the caller
 * (the playback pipeline) computes ChunkRequestCandidate.deadlineUs; this class only decides
 * which peer to ask and when to give up and re-ask.
 */
export class ChunkScheduler {
  private readonly inFlight = new Map<string, InFlightRequest>();
  private readonly inFlightByPeer = new Map<string, Set<string>>();
  private nextRequestSeq = 0;

  constructor(
    private readonly deps: ChunkSchedulerDeps,
    private readonly options: ChunkSchedulerOptions = {},
  ) {}

  schedule(candidates: ChunkRequestCandidate[]): void {
    this.reapTimedOut();

    const maxGlobal = this.options.maxGlobalInFlight ?? 32;
    const maxPerPeer = this.options.maxInFlightPerPeer ?? 4;
    const sorted = [...candidates].sort((a, b) => a.deadlineUs - b.deadlineUs);

    for (const candidate of sorted) {
      if (this.inFlight.size >= maxGlobal) break;

      const key = this.keyOf(candidate.assetHash, candidate.chunkIndex);
      if (this.inFlight.has(key)) continue;
      if (candidate.candidatePeerIds.length === 0) continue;

      const peerId = this.pickLeastBusyPeer(candidate.candidatePeerIds, maxPerPeer);
      if (!peerId) continue;

      this.issueRequest(peerId, candidate, key);
    }
  }

  onChunkReceived(assetHash: string, chunkIndex: number): void {
    this.clearInFlight(this.keyOf(assetHash, chunkIndex));
  }

  /** Lets the caller give up on a chunk early (e.g. the user seeked past it). */
  cancel(assetHash: string, chunkIndex: number): void {
    const key = this.keyOf(assetHash, chunkIndex);
    const request = this.inFlight.get(key);
    if (!request) return;
    this.deps.cancelChunk(request.peerId, request.assetHash, request.chunkIndex, request.requestId);
    this.clearInFlight(key);
  }

  getInFlightCount(): number {
    return this.inFlight.size;
  }

  isInFlight(assetHash: string, chunkIndex: number): boolean {
    return this.inFlight.has(this.keyOf(assetHash, chunkIndex));
  }

  private issueRequest(peerId: string, candidate: ChunkRequestCandidate, key: string): void {
    const requestId = `req-${this.nextRequestSeq++}`;
    this.inFlight.set(key, {
      requestId,
      assetHash: candidate.assetHash,
      chunkIndex: candidate.chunkIndex,
      peerId,
      requestedAtMs: this.now(),
    });
    const peerSet = this.inFlightByPeer.get(peerId) ?? new Set<string>();
    peerSet.add(key);
    this.inFlightByPeer.set(peerId, peerSet);

    this.deps.requestChunk(peerId, candidate.assetHash, candidate.chunkIndex, this.priorityFromDeadline(candidate.deadlineUs), requestId);
  }

  private reapTimedOut(): void {
    const timeoutMs = this.options.requestTimeoutMs ?? 5000;
    const now = this.now();
    for (const [key, request] of this.inFlight) {
      if (now - request.requestedAtMs > timeoutMs) {
        this.deps.cancelChunk(request.peerId, request.assetHash, request.chunkIndex, request.requestId);
        this.clearInFlight(key);
      }
    }
  }

  private clearInFlight(key: string): void {
    const request = this.inFlight.get(key);
    if (!request) return;
    this.inFlight.delete(key);
    this.inFlightByPeer.get(request.peerId)?.delete(key);
  }

  private pickLeastBusyPeer(peerIds: string[], maxPerPeer: number): string | undefined {
    let best: string | undefined;
    let bestLoad = Number.POSITIVE_INFINITY;
    for (const peerId of peerIds) {
      const load = this.inFlightByPeer.get(peerId)?.size ?? 0;
      if (load >= maxPerPeer) continue;
      if (load < bestLoad) {
        bestLoad = load;
        best = peerId;
      }
    }
    return best;
  }

  /** Larger = more urgent. Chunks already past their deadline (stalling playback) max out. */
  private priorityFromDeadline(deadlineUs: number): number {
    if (deadlineUs <= 0) return 1000;
    return Math.max(0, 1000 - Math.floor(deadlineUs / 1000));
  }

  private keyOf(assetHash: string, chunkIndex: number): string {
    return `${assetHash}:${chunkIndex}`;
  }

  private now(): number {
    return (this.deps.now ?? Date.now)();
  }
}
