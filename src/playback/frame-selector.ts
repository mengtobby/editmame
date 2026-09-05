export interface TimedFrame<F> {
  timestampUs: number;
  frame: F;
}

export interface FrameSelection<F> {
  frame: F | null;
  /** Frames older than the selected one, already passed by the clock. The caller must dispose
   *  these (e.g. VideoFrame.close()) — this module only decides which frames to drop, since it
   *  has no knowledge of the frame type's resource-release API. */
  dropped: F[];
}

/**
 * Picks the newest queued frame whose timestamp has already arrived, and reports everything
 * older as droppable. Deliberately drops stale frames rather than presenting them out of order:
 * a decoder that's fallen behind should catch up to the audio clock, not play back-to-back late
 * frames and fall further behind.
 */
export function selectFrameForTime<F>(queue: TimedFrame<F>[], mediaTimeUs: number): FrameSelection<F> {
  let selectedIndex = -1;
  for (let i = 0; i < queue.length; i += 1) {
    if (queue[i]!.timestampUs <= mediaTimeUs) selectedIndex = i;
    else break;
  }

  if (selectedIndex === -1) {
    return { frame: null, dropped: [] };
  }

  const dropped = queue.slice(0, selectedIndex).map((f) => f.frame);
  const frame = queue[selectedIndex]!.frame;
  queue.splice(0, selectedIndex + 1);
  return { frame, dropped };
}
