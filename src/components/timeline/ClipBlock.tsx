import type { ClipRecord, TimelineEngine } from "@/types/timeline";
import { MIN_CLIP_DURATION_US, pixelsToUs, usToPixels } from "./constants";

interface ClipBlockProps {
  clip: ClipRecord;
  engine: TimelineEngine;
  isSelected: boolean;
  onSelect: () => void;
}

export function ClipBlock({ clip, engine, isSelected, onSelect }: ClipBlockProps) {
  const left = usToPixels(clip.startOnTimelineUs);
  const width = Math.max(6, usToPixels(clip.durationUs));

  const handleMovePointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    onSelect();

    const startX = event.clientX;
    const initialStartUs = clip.startOnTimelineUs;

    const onMove = (moveEvent: PointerEvent) => {
      const deltaUs = pixelsToUs(moveEvent.clientX - startX);
      engine.moveClip(clip.id, { startOnTimelineUs: Math.max(0, Math.round(initialStartUs + deltaUs)) });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const handleTrimPointerDown = (edge: "left" | "right") => (event: React.PointerEvent) => {
    event.stopPropagation();
    onSelect();

    const startX = event.clientX;
    const initial = {
      inPointUs: clip.inPointUs,
      outPointUs: clip.outPointUs,
      startOnTimelineUs: clip.startOnTimelineUs,
    };

    const onMove = (moveEvent: PointerEvent) => {
      const deltaUs = pixelsToUs(moveEvent.clientX - startX);

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
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div
      onPointerDown={handleMovePointerDown}
      className={`absolute bottom-1 top-1 select-none overflow-hidden rounded-md border bg-gradient-to-b from-indigo-500/85 to-indigo-700/85 shadow-sm active:cursor-grabbing ${
        isSelected ? "border-accent-300 ring-1 ring-accent-300" : "border-black/40"
      }`}
      style={{ left, width, cursor: "grab" }}
    >
      <div className="pointer-events-none truncate px-2 py-1 text-[11px] font-medium text-white/90">
        {clip.label ?? clip.assetHash.slice(0, 8)}
      </div>
      <div
        onPointerDown={handleTrimPointerDown("left")}
        className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize hover:bg-white/30"
      />
      <div
        onPointerDown={handleTrimPointerDown("right")}
        className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize hover:bg-white/30"
      />
    </div>
  );
}
