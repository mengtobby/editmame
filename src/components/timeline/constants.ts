export const PIXELS_PER_SECOND = 80;
export const TRACK_HEIGHT = 52;
export const TRACK_HEADER_WIDTH = 144;
export const RULER_HEIGHT = 28;
export const MIN_CLIP_DURATION_US = 200_000;

export function usToPixels(us: number): number {
  return (us / 1_000_000) * PIXELS_PER_SECOND;
}

export function pixelsToUs(px: number): number {
  return (px / PIXELS_PER_SECOND) * 1_000_000;
}
