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
  const progress = durationUs > 0 ? Math.min(currentTimeUs, durationUs) / durationUs : 0;

  return (
    <div className="flex h-full flex-col bg-gray-100 p-4">
      <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-lg bg-black shadow-card">
        <canvas
          ref={canvasRef}
          width={meta.widthPx}
          height={meta.heightPx}
          className="max-h-full max-w-full"
          style={{ aspectRatio: `${meta.widthPx} / ${meta.heightPx}` }}
        />
        {lastError && (
          <div className="absolute bottom-3 left-3 right-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 shadow-card">
            {lastError}
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-2 pt-3">
        <div className="group relative flex h-4 items-center">
          <div className="h-1 w-full rounded-full bg-gray-300">
            <div className="h-1 rounded-full bg-accent-500" style={{ width: `${progress * 100}%` }} />
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(durationUs, 1)}
            value={Math.min(currentTimeUs, durationUs)}
            onChange={(event) => seek(Number(event.target.value))}
            aria-label="Seek"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
          <div
            className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 rounded-full bg-accent-500 opacity-0 shadow-toolbar transition-opacity group-hover:opacity-100"
            style={{ left: `${progress * 100}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <IconButton onClick={() => onStepFrame(-1)} label="Previous frame">
              <StepIcon direction="back" />
            </IconButton>
            <button
              type="button"
              onClick={isPlaying ? pause : play}
              aria-label={isPlaying ? "Pause" : "Play"}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-500 text-white shadow-toolbar transition-colors hover:bg-accent-600"
            >
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>
            <IconButton onClick={() => onStepFrame(1)} label="Next frame">
              <StepIcon direction="forward" />
            </IconButton>
          </div>

          <span className="font-mono text-xs tabular-nums text-gray-500">
            {formatTimecode(currentTimeUs, meta.frameRateNum, meta.frameRateDen)}
            <span className="text-gray-300"> / </span>
            {formatTimecode(durationUs, meta.frameRateNum, meta.frameRateDen)}
          </span>
        </div>
      </div>
    </div>
  );
}

function IconButton({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-800"
    >
      {children}
    </button>
  );
}

function StepIcon({ direction }: { direction: "back" | "forward" }) {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor">
      {direction === "forward" ? (
        <>
          <path d="M2 3v10l8-5-8-5Z" />
          <rect x="11.5" y="3" width="1.5" height="10" />
        </>
      ) : (
        <>
          <rect x="3" y="3" width="1.5" height="10" />
          <path d="M14 3v10l-8-5 8-5Z" />
        </>
      )}
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg className="ml-0.5 h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
      <path d="M4 2.5v11l10-5.5-10-5.5Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
      <path d="M3.5 2.5h3v11h-3v-11Zm6 0h3v11h-3v-11Z" />
    </svg>
  );
}
