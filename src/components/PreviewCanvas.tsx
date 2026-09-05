import { formatTimecode } from "@/playback/timecode";
import type { PlaybackWorkerApi } from "@/hooks/usePlaybackWorker";
import type { ProjectMeta } from "@/types/timeline";

interface PreviewCanvasProps {
  playback: PlaybackWorkerApi;
  meta: ProjectMeta;
  durationUs: number;
  onStepFrame: (direction: 1 | -1) => void;
}

export function PreviewCanvas({ playback, meta, durationUs, onStepFrame }: PreviewCanvasProps) {
  const { canvasRef, isPlaying, currentTimeUs, lastError, play, pause, seek } = playback;

  return (
    <div className="flex h-full flex-col bg-black">
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <canvas
          ref={canvasRef}
          width={meta.widthPx}
          height={meta.heightPx}
          className="max-h-full max-w-full"
          style={{ aspectRatio: `${meta.widthPx} / ${meta.heightPx}` }}
        />
        {lastError && (
          <div className="absolute bottom-2 left-2 right-2 rounded-md bg-red-950/90 px-3 py-2 text-xs text-red-300">
            {lastError}
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-2 border-t border-neutral-800 bg-surface-900 px-4 py-2.5">
        <input
          type="range"
          min={0}
          max={Math.max(durationUs, 1)}
          value={Math.min(currentTimeUs, durationUs)}
          onChange={(event) => seek(Number(event.target.value))}
          className="h-1 w-full cursor-pointer appearance-none rounded-full bg-neutral-800 accent-accent-500"
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onStepFrame(-1)}
              className="rounded p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
              aria-label="Previous frame"
            >
              <StepIcon direction="back" />
            </button>
            <button
              type="button"
              onClick={isPlaying ? pause : play}
              className="rounded-md bg-accent-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-500"
            >
              {isPlaying ? "Pause" : "Play"}
            </button>
            <button
              type="button"
              onClick={() => onStepFrame(1)}
              className="rounded p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
              aria-label="Next frame"
            >
              <StepIcon direction="forward" />
            </button>
          </div>

          <span className="font-mono text-xs text-neutral-400">
            {formatTimecode(currentTimeUs, meta.frameRateNum, meta.frameRateDen)}
            <span className="text-neutral-700"> / </span>
            {formatTimecode(durationUs, meta.frameRateNum, meta.frameRateDen)}
          </span>
        </div>
      </div>
    </div>
  );
}

function StepIcon({ direction }: { direction: "back" | "forward" }) {
  const flip = direction === "back" ? "scale-x-[-1]" : "";
  return (
    <svg className={`h-3.5 w-3.5 ${flip}`} viewBox="0 0 16 16" fill="currentColor">
      <path d="M3 3h1.5v10H3V3zm3 5 8-5v10l-8-5z" />
    </svg>
  );
}
