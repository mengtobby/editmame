import type { ClipRecord, TimelineEngine, TrackKind } from "@/types/timeline";
import { MIN_CLIP_DURATION_US, usToPixels } from "./constants";
import { startHorizontalDragUs } from "./drag";

interface ClipBlockProps {
  clip: ClipRecord;
  trackKind: TrackKind;
  engine: TimelineEngine;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

const CLIP_COLOR: Record<TrackKind, string> = {
  video: "bg-clip-video",
  audio: "bg-clip-audio",
};

export function ClipBlock({ clip, trackKind, engine, isSelected, onSelect, onDelete }: ClipBlockProps) {
  const left = usToPixels(clip.startOnTimelineUs);
  const width = Math.max(6, usToPixels(clip.durationUs));

  const handleMovePointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    onSelect();

    const initialStartUs = clip.startOnTimelineUs;
    startHorizontalDragUs(event, (deltaUs) => {
      engine.moveClip(clip.id, { startOnTimelineUs: Math.max(0, Math.round(initialStartUs + deltaUs)) });
    });
  };

  const handleTrimPointerDown = (edge: "left" | "right") => (event: React.PointerEvent) => {
    event.stopPropagation();
    onSelect();

    const initial = {
      inPointUs: clip.inPointUs,
      outPointUs: clip.outPointUs,
      startOnTimelineUs: clip.startOnTimelineUs,
    };

    startHorizontalDragUs(event, (deltaUs) => {
      if (edge === "left") {
        const newIn = Math.min(
          Math.max(0, initial.inPointUs + deltaUs),
          initial.outPointUs - MIN_CLIP_DURATION_US,
        );
        const actualDelta = newIn - initial.inPointUs;
        engine.trimClip(clip.id, {
          inPointUs: Math.round(newIn),
          startOnTimelineUs: Math.max(0, Math.round(initial.startOnTimelineUs + actualDelta)),
          durationUs: Math.round(initial.outPointUs - newIn),
        });
      } else {
        const newOut = Math.max(initial.outPointUs + deltaUs, initial.inPointUs + MIN_CLIP_DURATION_US);
        engine.trimClip(clip.id, {
          outPointUs: Math.round(newOut),
          durationUs: Math.round(newOut - initial.inPointUs),
        });
      }
    });
  };

  return (
    <div
      onPointerDown={handleMovePointerDown}
      title={clip.label ?? clip.assetHash}
      className={`absolute bottom-1 top-1 select-none overflow-hidden rounded ${CLIP_COLOR[trackKind]} shadow-sm active:cursor-grabbing ${
        isSelected ? "ring-2 ring-accent-500 ring-offset-1" : ""
      }`}
      style={{ left, width, cursor: "grab" }}
    >
      <div className="pointer-events-none truncate px-2 py-1.5 text-[11px] font-medium text-white">
        {clip.label ?? clip.assetHash.slice(0, 8)}
      </div>
      <div
        onPointerDown={handleTrimPointerDown("left")}
        className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize hover:bg-white/40"
      />
      <div
        onPointerDown={handleTrimPointerDown("right")}
        className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize hover:bg-white/40"
      />
      {isSelected && (
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          title="Delete clip"
          aria-label="Delete clip"
          className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/70"
        >
          <svg viewBox="0 0 10 10" fill="none" className="h-2.5 w-2.5">
            <path d="M2 2l6 6M8 2 2 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}
