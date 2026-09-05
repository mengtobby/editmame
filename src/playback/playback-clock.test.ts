import { describe, expect, it } from "vitest";
import { PlaybackClock } from "./playback-clock";

describe("PlaybackClock", () => {
  it("stays at zero until played", () => {
    let now = 0;
    const clock = new PlaybackClock({ now: () => now });
    now = 5000;
    expect(clock.getMediaTimeUs()).toBe(0);
  });

  it("advances media time at wall-clock rate while playing", () => {
    let now = 0;
    const clock = new PlaybackClock({ now: () => now });
    clock.play();
    now = 1000; // 1 second of wall time
    expect(clock.getMediaTimeUs()).toBe(1_000_000); // 1 second in microseconds
  });

  it("freezes media time on pause and resumes from there", () => {
    let now = 0;
    const clock = new PlaybackClock({ now: () => now });
    clock.play();
    now = 500;
    clock.pause();
    expect(clock.getMediaTimeUs()).toBe(500_000);

    now = 2000; // time passes while paused
    expect(clock.getMediaTimeUs()).toBe(500_000);

    clock.play();
    now = 2500;
    expect(clock.getMediaTimeUs()).toBe(1_000_000);
  });

  it("jumps directly to the seeked position", () => {
    let now = 0;
    const clock = new PlaybackClock({ now: () => now });
    clock.seek(3_000_000);
    expect(clock.getMediaTimeUs()).toBe(3_000_000);

    clock.play();
    now = 250;
    expect(clock.getMediaTimeUs()).toBe(3_250_000);
  });

  it("scales elapsed time by the playback rate", () => {
    let now = 0;
    const clock = new PlaybackClock({ now: () => now });
    clock.setRate(2);
    clock.play();
    now = 1000;
    expect(clock.getMediaTimeUs()).toBe(2_000_000);
  });

  it("ignores small drift but snaps to authoritative time past the threshold", () => {
    let now = 0;
    const clock = new PlaybackClock({ now: () => now });
    clock.play();
    now = 1000; // clock reads 1,000,000us

    clock.resyncTo(1_010_000, 30_000); // 10ms drift, under threshold
    expect(clock.getMediaTimeUs()).toBe(1_000_000);

    clock.resyncTo(1_100_000, 30_000); // 100ms drift, over threshold
    expect(clock.getMediaTimeUs()).toBe(1_100_000);
  });
});
