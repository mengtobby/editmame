import type { TimelineEngine, TrackWithClips } from "@/types/timeline";
import { TimelineRuler } from "./TimelineRuler";
import { TrackRow } from "./TrackRow";
import { PIXELS_PER_SECOND, RULER_HEIGHT, TRACK_HEADER_WIDTH } from "./constants";

interface TimelineProps {
  engine: TimelineEngine;
  tracks: TrackWithClips[];
  durationUs: number;
  currentTimeUs: number;
  onSeek: (mediaTimeUs: number) => void;
  selectedClipId: string | null;
  onSelectClip: (clipId: string | null) => void;
}

export function Timeline({ engine, tracks, durationUs, currentTimeUs, onSeek, selectedClipId, onSelectClip }: TimelineProps) {
  const laneWidthPx = (durationUs / 1_000_000) * PIXELS_PER_SECOND;
  const playheadLeft = TRACK_HEADER_WIDTH + (currentTimeUs / 1_000_000) * PIXELS_PER_SECOND;

  return (
    <div className="h-full overflow-auto bg-gray-50 scrollbar-thin" onPointerDown={() => onSelectClip(null)}>
      <div className="relative" style={{ width: TRACK_HEADER_WIDTH + laneWidthPx }}>
        <div className="sticky top-0 z-10 flex">
          <div className="shrink-0 border-b border-r border-gray-200 bg-white" style={{ width: TRACK_HEADER_WIDTH }} />
          <TimelineRuler durationUs={durationUs} widthPx={laneWidthPx} onScrub={onSeek} />
        </div>

        {tracks.length === 0 && (
          <p className="px-4 py-8 text-sm text-gray-400">
            No tracks yet — import a video or add a track to get started.
          </p>
        )}

        {tracks.map((track, index) => (
          <TrackRow
            key={track.id}
            track={track}
            index={index}
            allTracks={tracks}
            engine={engine}
            selectedClipId={selectedClipId}
            onSelectClip={onSelectClip}
            widthPx={laneWidthPx}
          />
        ))}

        <div className="pointer-events-none absolute bottom-0 w-px bg-playhead" style={{ left: playheadLeft, top: RULER_HEIGHT }}>
          <div
            className="absolute -top-0 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-playhead"
            style={{ top: -RULER_HEIGHT + 4 }}
          />
        </div>
      </div>
    </div>
  );
}
