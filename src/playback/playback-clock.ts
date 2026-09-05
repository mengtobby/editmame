export interface PlaybackClockOptions {
  /** Wall-clock source in milliseconds; injectable so tests don't depend on real time. */
  now?: () => number;
}

/**
 * Maps wall-clock time to a position in the project timeline (microseconds), independent of
 * decoding/rendering. Play/pause/seek/rate changes all work by re-anchoring: record the media
 * time and wall time at the moment of the change, then compute later positions by extrapolating
 * from that anchor. This keeps the clock itself simple and drift-free; actual audio/video drift
 * correction happens via `resyncTo`, called with the authoritative time from the audio clock
 * (audio can't be repeated/dropped without an audible glitch, so it drives sync; video frames
 * are chosen to match it — see selectFrameForTime in frame-selector.ts).
 */
export class PlaybackClock {
  private readonly now: () => number;
  private playing = false;
  private rate = 1;
  private anchorMediaTimeUs = 0;
  private anchorWallTimeMs: number;

  constructor(options: PlaybackClockOptions = {}) {
    this.now = options.now ?? (() => performance.now());
    this.anchorWallTimeMs = this.now();
  }

  play(): void {
    if (this.playing) return;
    this.anchorMediaTimeUs = this.getMediaTimeUs();
    this.anchorWallTimeMs = this.now();
    this.playing = true;
  }

  pause(): void {
    if (!this.playing) return;
    this.anchorMediaTimeUs = this.getMediaTimeUs();
    this.playing = false;
  }

  seek(mediaTimeUs: number): void {
    this.anchorMediaTimeUs = mediaTimeUs;
    this.anchorWallTimeMs = this.now();
  }

  setRate(rate: number): void {
    this.anchorMediaTimeUs = this.getMediaTimeUs();
    this.anchorWallTimeMs = this.now();
    this.rate = rate;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  getRate(): number {
    return this.rate;
  }

  getMediaTimeUs(): number {
    if (!this.playing) return this.anchorMediaTimeUs;
    const elapsedMs = this.now() - this.anchorWallTimeMs;
    return this.anchorMediaTimeUs + elapsedMs * 1000 * this.rate;
  }

  /** Snaps the clock to an authoritative time source, but only past a threshold, so ordinary
   *  audio-callback jitter doesn't cause a visible video jump every frame. */
  resyncTo(authoritativeMediaTimeUs: number, driftThresholdUs = 30_000): void {
    const drift = authoritativeMediaTimeUs - this.getMediaTimeUs();
    if (Math.abs(drift) > driftThresholdUs) {
      this.seek(authoritativeMediaTimeUs);
    }
  }
}
