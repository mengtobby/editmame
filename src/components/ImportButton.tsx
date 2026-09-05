import { useRef, useState } from "react";
import { importMediaFile } from "@/media/import-media";
import type { SwarmPeer } from "@/p2p/swarm-peer";
import type { ChunkStore } from "@/storage/chunk-store";
import type { TimelineEngine, TrackWithClips } from "@/types/timeline";

interface ImportButtonProps {
  engine: TimelineEngine;
  chunkStore: ChunkStore;
  swarm: SwarmPeer | null;
  tracks: TrackWithClips[];
  playheadUs: number;
}

export function ImportButton({ engine, chunkStore, swarm, tracks, playheadUs }: ImportButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;

    setBusy(true);
    try {
      const imported = await importMediaFile(file, chunkStore);

      let videoTrack = tracks.find((t) => t.kind === "video");
      if (!videoTrack) {
        const created = engine.addTrack({
          id: crypto.randomUUID(),
          kind: "video",
          name: "V1",
          muted: false,
          locked: false,
          hidden: false,
          zIndex: tracks.length,
        });
        videoTrack = { ...created, clips: [] };
      }

      engine.addClip({
        id: crypto.randomUUID(),
        trackId: videoTrack.id,
        assetHash: imported.manifest.assetHash,
        inPointUs: 0,
        outPointUs: imported.durationUs,
        startOnTimelineUs: playheadUs,
        durationUs: imported.durationUs,
        label: file.name,
      });

      if (swarm) await swarm.announceLocalAsset(imported.manifest);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <label
      className={`cursor-pointer rounded-md border border-neutral-800 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 ${
        busy ? "pointer-events-none opacity-50" : ""
      }`}
    >
      {busy ? "Importing…" : "Import Media"}
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(event) => void handleFiles(event.target.files)}
      />
    </label>
  );
}
