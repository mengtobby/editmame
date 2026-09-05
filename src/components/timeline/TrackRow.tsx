import type { TimelineEngine, TrackWithClips } from "@/types/timeline";
import { ClipBlock } from "./ClipBlock";
import { TRACK_HEADER_WIDTH, TRACK_HEIGHT } from "./constants";

interface TrackRowProps {
  track: TrackWithClips;
  index: number;
  allTracks: TrackWithClips[];
  engine: TimelineEngine;
  selectedClipId: string | null;
  onSelectClip: (clipId: string) => void;
  widthPx: number;
}

export function TrackRow({ track, index, allTracks, engine, selectedClipId, onSelectClip, widthPx }: TrackRowProps) {
  const isFirst = index === 0;
  const isLast = index === allTracks.length - 1;

  const moveUp = () => {
    if (isFirst) return;
    const beforeId = index >= 2 ? allTracks[index - 2]!.id : null;
    engine.reorderTrack(track.id, beforeId, allTracks[index - 1]!.id);
  };

  const moveDown = () => {
    if (isLast) return;
    const afterId = index + 2 < allTracks.length ? allTracks[index + 2]!.id : null;
    engine.reorderTrack(track.id, allTracks[index + 1]!.id, afterId);
  };

  return (
    <div className="flex border-b border-neutral-800">
      <div
        className="flex shrink-0 flex-col justify-center gap-1 border-r border-neutral-800 bg-surface-900 px-2.5"
        style={{ width: TRACK_HEADER_WIDTH, height: TRACK_HEIGHT }}
      >
        <div className="flex items-center justify-between">
          <span className="truncate text-xs font-medium text-neutral-300">{track.name}</span>
          <div className="flex gap-0.5">
            <button
              type="button"
              onClick={moveUp}
              disabled={isFirst}
              className="rounded px-1 text-[10px] text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200 disabled:opacity-30"
              aria-label="Move track up"
            >
              ▲
            </button>
            <button
              type="button"
              onClick={moveDown}
              disabled={isLast}
              className="rounded px-1 text-[10px] text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200 disabled:opacity-30"
              aria-label="Move track down"
            >
              ▼
            </button>
          </div>
        </div>
        <div className="flex gap-1">
          <TrackToggle label="M" active={track.muted} onClick={() => engine.updateTrack(track.id, { muted: !track.muted })} />
          <TrackToggle label="L" active={track.locked} onClick={() => engine.updateTrack(track.id, { locked: !track.locked })} />
          <TrackToggle label="H" active={track.hidden} onClick={() => engine.updateTrack(track.id, { hidden: !track.hidden })} />
        </div>
      </div>

      <div className="relative shrink-0 bg-surface-950" style={{ width: widthPx, height: TRACK_HEIGHT }}>
        {track.clips.map((clip) => (
          <ClipBlock
            key={clip.id}
            clip={clip}
            engine={engine}
            isSelected={selectedClipId === clip.id}
            onSelect={() => onSelectClip(clip.id)}
          />
        ))}
      </div>
    </div>
  );
}

function TrackToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-4 w-4 rounded text-[9px] font-semibold leading-4 ${
        active ? "bg-accent-600 text-white" : "bg-neutral-800 text-neutral-500 hover:text-neutral-300"
      }`}
    >
      {label}
    </button>
  );
}
