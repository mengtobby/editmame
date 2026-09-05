import { describe, expect, it } from "vitest";
import { selectFrameForTime, type TimedFrame } from "./frame-selector";

function frames(...timestampsUs: number[]): TimedFrame<string>[] {
  return timestampsUs.map((timestampUs) => ({ timestampUs, frame: `frame@${timestampUs}` }));
}

describe("selectFrameForTime", () => {
  it("returns null with no drops when no frame has arrived yet", () => {
    const queue = frames(1000, 2000);
    const result = selectFrameForTime(queue, 500);
    expect(result.frame).toBeNull();
    expect(result.dropped).toEqual([]);
    expect(queue).toHaveLength(2); // untouched
  });

  it("selects the single frame whose timestamp has arrived", () => {
    const queue = frames(0, 1000, 2000);
    const result = selectFrameForTime(queue, 1000);
    expect(result.frame).toBe("frame@1000");
    expect(result.dropped).toEqual(["frame@0"]);
    expect(queue).toEqual(frames(2000));
  });

  it("drops every stale frame when the clock has jumped ahead", () => {
    const queue = frames(0, 500, 1000, 1500, 5000);
    const result = selectFrameForTime(queue, 2000);
    expect(result.frame).toBe("frame@1500");
    expect(result.dropped).toEqual(["frame@0", "frame@500", "frame@1000"]);
    expect(queue).toEqual(frames(5000));
  });

  it("consumes the whole queue if every frame has already arrived", () => {
    const queue = frames(0, 100, 200);
    const result = selectFrameForTime(queue, 10_000);
    expect(result.frame).toBe("frame@200");
    expect(result.dropped).toEqual(["frame@0", "frame@100"]);
    expect(queue).toEqual([]);
  });
});
