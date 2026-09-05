import { describe, expect, it } from "vitest";
import { computeVisibleClips } from "./visible-clips";
import type { TrackWithClips } from "@/types/timeline";

function track(overrides: Partial<TrackWithClips> = {}): TrackWithClips {
  return {
    id: "track-1",
    kind: "video",
    name: "V1",
    order: "a0",
    muted: false,
    locked: false,
    hidden: false,
    zIndex: 0,
    clips: [],
    ...overrides,
  };
}

describe("computeVisibleClips", () => {
  it("returns the clip covering the current time on a video track", () => {
    const tracks = [
      track({
        clips: [
          {
            id: "clip-1",
            trackId: "track-1",
            assetHash: "hash-1",
            inPointUs: 1_000_000,
            outPointUs: 3_000_000,
            startOnTimelineUs: 0,
            durationUs: 2_000_000,
            order: "a0",
          },
        ],
      }),
    ];

    const layers = computeVisibleClips(tracks, 500_000);
    expect(layers).toHaveLength(1);
    expect(layers[0]!.assetHash).toBe("hash-1");
    expect(layers[0]!.inPointUs).toBe(1_000_000);
    expect(layers[0]!.startOnTimelineUs).toBe(0);
  });

  it("skips audio tracks and hidden video tracks", () => {
    const clip = {
      id: "clip-1",
      trackId: "track-1",
      assetHash: "hash-1",
      inPointUs: 0,
      outPointUs: 1_000_000,
      startOnTimelineUs: 0,
      durationUs: 1_000_000,
      order: "a0",
    };

    const tracks = [
      track({ id: "audio", kind: "audio", clips: [{ ...clip, trackId: "audio" }] }),
      track({ id: "hidden-video", hidden: true, clips: [{ ...clip, trackId: "hidden-video" }] }),
    ];

    expect(computeVisibleClips(tracks, 500_000)).toEqual([]);
  });

  it("returns nothing when the playhead is outside every clip's range", () => {
    const tracks = [
      track({
        clips: [
          { id: "clip-1", trackId: "track-1", assetHash: "hash-1", inPointUs: 0, outPointUs: 1_000_000, startOnTimelineUs: 0, durationUs: 1_000_000, order: "a0" },
        ],
      }),
    ];

    expect(computeVisibleClips(tracks, 5_000_000)).toEqual([]);
  });

  it("orders layers by each track's zIndex for compositing", () => {
    const makeClip = (trackId: string) => ({
      id: `clip-${trackId}`,
      trackId,
      assetHash: `hash-${trackId}`,
      inPointUs: 0,
      outPointUs: 1_000_000,
      startOnTimelineUs: 0,
      durationUs: 1_000_000,
      order: "a0",
    });

    const tracks = [
      track({ id: "back", zIndex: 0, clips: [makeClip("back")] }),
      track({ id: "front", zIndex: 1, clips: [makeClip("front")] }),
    ];

    const layers = computeVisibleClips(tracks, 500_000);
    expect(layers.map((l) => l.zIndex)).toEqual([0, 1]);
  });
});
