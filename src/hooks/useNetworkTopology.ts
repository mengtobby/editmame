import { useEffect, useRef, useState } from "react";
import type { PeerConnectionManager } from "@/p2p/peer-connection-manager";
import type { SwarmPeer } from "@/p2p/swarm-peer";
import type { ChunkExchangeEvent, PeerInfo, ThroughputSample } from "@/types/network";

const SAMPLE_INTERVAL_MS = 1000;
const MAX_EXCHANGE_LOG = 30;
const PEER_COLORS = ["#f97316", "#22d3ee", "#a78bfa", "#4ade80", "#f472b6", "#facc15"];

export function colorFor(peerId: string): string {
  let hash = 0;
  for (let i = 0; i < peerId.length; i += 1) hash = (hash * 31 + peerId.charCodeAt(i)) >>> 0;
  return PEER_COLORS[hash % PEER_COLORS.length]!;
}

export interface NetworkTopologyState {
  peers: PeerInfo[];
  throughput: Map<string, ThroughputSample>;
  recentExchanges: ChunkExchangeEvent[];
}

/** Aggregates real byte counters from PeerConnectionManager and real chunk transfer events from
 *  SwarmPeer into per-second samples for the topology panel — nothing here is simulated. */
export function useNetworkTopology(
  manager: PeerConnectionManager | null,
  swarm: SwarmPeer | null,
  connectedPeerIds: string[],
): NetworkTopologyState {
  const [throughput, setThroughput] = useState<Map<string, ThroughputSample>>(new Map());
  const [recentExchanges, setRecentExchanges] = useState<ChunkExchangeEvent[]>([]);
  const countersRef = useRef(new Map<string, { up: number; down: number }>());

  useEffect(() => {
    if (!manager) return;

    const bump = (peerId: string, field: "up" | "down", bytes: number) => {
      const counters = countersRef.current;
      const entry = counters.get(peerId) ?? { up: 0, down: 0 };
      entry[field] += bytes;
      counters.set(peerId, entry);
    };

    const offSent = manager.on("bytes-sent", ({ peerId, bytes }) => bump(peerId, "up", bytes));
    const offReceived = manager.on("bytes-received", ({ peerId, bytes }) => bump(peerId, "down", bytes));

    const interval = setInterval(() => {
      const now = Date.now();
      const next = new Map<string, ThroughputSample>();
      for (const [peerId, counters] of countersRef.current) {
        next.set(peerId, { peerId, timestampMs: now, bytesUpPerSec: counters.up, bytesDownPerSec: counters.down });
      }
      countersRef.current = new Map();
      setThroughput(next);
    }, SAMPLE_INTERVAL_MS);

    return () => {
      offSent();
      offReceived();
      clearInterval(interval);
    };
  }, [manager]);

  useEffect(() => {
    if (!swarm) return;
    swarm.onChunkExchange = (event) => {
      setRecentExchanges((prev) => [event, ...prev].slice(0, MAX_EXCHANGE_LOG));
    };
    return () => {
      swarm.onChunkExchange = null;
    };
  }, [swarm]);

  const peers: PeerInfo[] = connectedPeerIds.map((peerId) => ({
    peerId,
    displayName: peerId.slice(0, 8),
    color: colorFor(peerId),
    connectionState: "connected",
    dataChannelState: "open",
    joinedAtMs: 0,
  }));

  return { peers, throughput, recentExchanges };
}
