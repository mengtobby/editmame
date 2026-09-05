function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}

/** Formats a project-time position as an HH:MM:SS:FF timecode at the given frame rate. */
export function formatTimecode(mediaTimeUs: number, frameRateNum: number, frameRateDen: number): string {
  const fps = frameRateNum / frameRateDen;
  const totalFrames = Math.max(0, Math.round((mediaTimeUs / 1_000_000) * fps));
  const framesPerSecond = Math.round(fps);

  const frames = totalFrames % framesPerSecond;
  const totalSeconds = Math.floor(totalFrames / framesPerSecond);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}:${pad(frames)}`;
}

/** Returns the media time one frame forward (direction=1) or backward (direction=-1), clamped
 *  to zero — used by the frame-step transport controls. */
export function stepFrameTimeUs(
  currentTimeUs: number,
  frameRateNum: number,
  frameRateDen: number,
  direction: 1 | -1,
): number {
  const frameDurationUs = (1_000_000 * frameRateDen) / frameRateNum;
  return Math.max(0, Math.round(currentTimeUs + direction * frameDurationUs));
}
