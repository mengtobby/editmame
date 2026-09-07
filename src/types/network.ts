/**
 * Types feeding the "Distributed Network Topology" panel: connection state, per-peer
 * throughput, and a rolling log of chunk exchanges, independent of the swarm's own internal
 * bookkeeping in wire-protocol.ts.
 */

export interface PeerInfo {
  peerId: string;
  displayName: string;
  /** Deterministic per-peer color for cursors/presence, derived from peerId. */
  color: string;
}

export interface ThroughputSample {
  peerId: string;
  timestampMs: number;
  bytesUpPerSec: number;
  bytesDownPerSec: number;
}

export interface ChunkExchangeEvent {
  peerId: string;
  assetHash: string;
  chunkIndex: number;
  direction: "upload" | "download";
  timestampMs: number;
}

