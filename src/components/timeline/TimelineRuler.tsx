import { PIXELS_PER_SECOND, RULER_HEIGHT } from "./constants";

interface TimelineRulerProps {
  durationUs: number;
  widthPx: number;
  onScrub: (mediaTimeUs: number) => void;
}

export function TimelineRuler({ durationUs, widthPx, onScrub }: TimelineRulerProps) {
  const totalSeconds = Math.max(1, Math.ceil(durationUs / 1_000_000));
  const ticks = Array.from({ length: totalSeconds + 1 }, (_, i) => i);

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    onScrub(Math.max(0, Math.round((x / PIXELS_PER_SECOND) * 1_000_000)));
  };

  return (
    <div
      onClick={handleClick}
      className="relative cursor-pointer border-b border-gray-200 bg-white"
      style={{ width: widthPx, height: RULER_HEIGHT }}
    >
      {ticks.map((second) => (
        <div key={second} className="absolute bottom-0 top-0" style={{ left: second * PIXELS_PER_SECOND }}>
          <div className="absolute bottom-0 h-1.5 w-px bg-gray-300" />
          {second % 5 === 0 && (
            <span className="absolute bottom-1.5 left-1 whitespace-nowrap text-[10px] text-gray-400">{second}s</span>
          )}
        </div>
      ))}
    </div>
  );
}
