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
    <div className="flex border-b border-gray-100">
      <div
        className="group flex shrink-0 flex-col justify-center gap-1.5 border-r border-gray-200 bg-white px-3"
        style={{ width: TRACK_HEADER_WIDTH, height: TRACK_HEIGHT }}
      >
        <div className="flex items-center justify-between">
          <span className="truncate text-xs font-medium text-gray-700">{track.name}</span>
          <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={moveUp}
              disabled={isFirst}
              className="rounded px-1 text-[10px] text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-0"
              aria-label="Move track up"
            >
              ▲
            </button>
            <button
              type="button"
              onClick={moveDown}
              disabled={isLast}
              className="rounded px-1 text-[10px] text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-0"
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

      <div className="relative shrink-0 bg-white" style={{ width: widthPx, height: TRACK_HEIGHT }}>
        {track.clips.map((clip) => (
          <ClipBlock
            key={clip.id}
            clip={clip}
            trackKind={track.kind}
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
      className={`h-4 w-4 rounded text-[9px] font-semibold leading-4 transition-colors ${
        active ? "bg-accent-500 text-white" : "bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
      }`}
    >
      {label}
    </button>
  );
}
