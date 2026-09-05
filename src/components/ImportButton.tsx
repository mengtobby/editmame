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
      className={`flex cursor-pointer items-center gap-1.5 rounded px-2.5 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 ${
        busy ? "pointer-events-none opacity-50" : ""
      }`}
    >
      <span className="text-gray-500">
        <UploadIcon />
      </span>
      {busy ? "Importing…" : "Import media"}
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

function UploadIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
      <path
        d="M8 10.5V2.5M8 2.5 5 5.5M8 2.5l3 3M3 11v1.5A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5V11"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
