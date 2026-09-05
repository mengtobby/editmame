import { useEffect, useMemo, useState } from "react";
import * as Y from "yjs";
import { attachCollabSync } from "@/p2p/collab-sync";
import { PeerConnectionManager, type SignalingState } from "@/p2p/peer-connection-manager";
import { SwarmPeer } from "@/p2p/swarm-peer";
import { createChunkStore } from "@/storage/create-chunk-store";
import type { ChunkStore } from "@/storage/chunk-store";
import type { ProjectMeta } from "@/types/timeline";
import { useRoomIdentity } from "./useRoomIdentity";
import { useTimelineEngine } from "./useTimelineEngine";

const SIGNALING_URL = (import.meta.env.VITE_SIGNALING_URL as string | undefined) ?? "ws://localhost:8787";

export interface CollabRoom {
  roomId: string;
  peerId: string;
  regenerateRoom: () => void;
  engine: ReturnType<typeof useTimelineEngine>["engine"];
  tracks: ReturnType<typeof useTimelineEngine>["tracks"];
  meta: ProjectMeta;
  connectedPeerIds: string[];
  signalingState: SignalingState;
  manager: PeerConnectionManager | null;
  swarm: SwarmPeer | null;
  chunkStore: ChunkStore;
}

function defaultMeta(roomId: string): ProjectMeta {
  return {
    id: roomId,
    name: "Untitled Project",
    frameRateNum: 30,
    frameRateDen: 1,
    widthPx: 1920,
    heightPx: 1080,
    createdAtMs: Date.now(),
  };
}

export function useCollabRoom(): CollabRoom {
  const { roomId, peerId, regenerateRoom } = useRoomIdentity();

  const ydoc = useMemo(() => new Y.Doc(), [roomId]);
  const meta = useMemo(() => defaultMeta(roomId), [roomId]);
  const { engine, tracks } = useTimelineEngine(ydoc, meta);

  const chunkStore = useMemo(() => createChunkStore(), []);
  const [connectedPeerIds, setConnectedPeerIds] = useState<string[]>([]);
  const [signalingState, setSignalingState] = useState<SignalingState>("connecting");
  const [manager, setManager] = useState<PeerConnectionManager | null>(null);
  const [swarm, setSwarm] = useState<SwarmPeer | null>(null);

  useEffect(() => {
    const nextManager = new PeerConnectionManager({ signalingUrl: SIGNALING_URL, roomId, peerId });
    const nextSwarm = new SwarmPeer(nextManager, chunkStore);
    setManager(nextManager);
    setSwarm(nextSwarm);
    setConnectedPeerIds([]);

    const detachSync = attachCollabSync(ydoc, nextManager);
    const updatePeers = () => setConnectedPeerIds(nextManager.getConnectedPeerIds());
    const offConnected = nextManager.on("peer-connected", updatePeers);
    const offDisconnected = nextManager.on("peer-disconnected", updatePeers);
    const offSignaling = nextManager.on("signaling-state", ({ state }) => setSignalingState(state));

    nextManager.connect();

    return () => {
      offConnected();
      offDisconnected();
      offSignaling();
      detachSync();
      nextSwarm.dispose();
      nextManager.destroy();
    };
  }, [roomId, peerId, ydoc, chunkStore]);

  return {
    roomId,
    peerId,
    regenerateRoom,
    engine,
    tracks,
    meta,
    connectedPeerIds,
    signalingState,
    manager,
    swarm,
    chunkStore,
  };
}
