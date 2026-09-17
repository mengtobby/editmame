import { useRef, useState, type ChangeEvent, type RefObject } from "react";
import { importMediaFile } from "@/media/import-media";
import type { SwarmPeer } from "@/p2p/swarm-peer";
import type { ChunkStore } from "@/storage/chunk-store";
import type { TimelineEngine, TrackWithClips } from "@/types/timeline";

interface UseMediaImportOptions {
  engine: TimelineEngine;
  chunkStore: ChunkStore;
  swarm: SwarmPeer | null;
  tracks: TrackWithClips[];
  playheadUs: number;
}

export interface MediaImportApi {
  busy: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  /** Opens the OS file picker — shared so any "import media" affordance (toolbar button, empty
   *  timeline state) can trigger the same hidden <input> instead of each owning its own. */
  triggerPicker: () => void;
  handleInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  importFile: (file: File) => Promise<void>;
}

/** Chunks/hashes a locally-picked or dropped file, adds it to the (first, or a newly-created)
 *  video track at the playhead, and announces it to the swarm. Shared by the toolbar's Import
 *  button, the empty-timeline call-to-action, and drag-and-drop import. */
export function useMediaImport({ engine, chunkStore, swarm, tracks, playheadUs }: UseMediaImportOptions): MediaImportApi {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const importFile = async (file: File) => {
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
    }
  };

  const triggerPicker = () => inputRef.current?.click();

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void importFile(file);
  };

  return { busy, inputRef, triggerPicker, handleInputChange, importFile };
}
