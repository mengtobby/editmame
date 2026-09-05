import { describe, expect, it } from "vitest";
import { formatTimecode, stepFrameTimeUs } from "./timecode";

describe("formatTimecode", () => {
  it("formats zero as 00:00:00:00", () => {
    expect(formatTimecode(0, 30, 1)).toBe("00:00:00:00");
  });

  it("formats whole seconds and minutes at 30fps", () => {
    expect(formatTimecode(1_000_000, 30, 1)).toBe("00:00:01:00");
    expect(formatTimecode(61_000_000, 30, 1)).toBe("00:01:01:00");
  });

  it("formats sub-second frame counts at 30fps", () => {
    expect(formatTimecode(500_000, 30, 1)).toBe("00:00:00:15");
  });

  it("handles NTSC-style fractional frame rates (30000/1001)", () => {
    expect(formatTimecode(0, 30000, 1001)).toBe("00:00:00:00");
    expect(formatTimecode(33_366, 30000, 1001)).toBe("00:00:00:01");
  });
});

describe("stepFrameTimeUs", () => {
  it("steps forward by one frame at 30fps", () => {
    expect(stepFrameTimeUs(0, 30, 1, 1)).toBeCloseTo(33_333, 0);
  });

  it("steps backward by one frame", () => {
    expect(stepFrameTimeUs(100_000, 30, 1, -1)).toBeCloseTo(66_667, 0);
  });

  it("never steps below zero", () => {
    expect(stepFrameTimeUs(0, 30, 1, -1)).toBe(0);
  });
});
