import type { TrackWithClips } from "@/types/timeline";
import { identityTransform } from "./transform";
import type { RenderableClip } from "@/workers/worker-messages";

/** Resolves which clip (if any) is on-screen for each non-hidden video track at the given
 *  project time, producing the layer list the render worker composites this frame. */
export function computeVisibleClips(tracks: TrackWithClips[], mediaTimeUs: number): RenderableClip[] {
  const layers: RenderableClip[] = [];

  for (const track of tracks) {
    if (track.kind !== "video" || track.hidden) continue;

    const clip = track.clips.find(
      (c) => mediaTimeUs >= c.startOnTimelineUs && mediaTimeUs < c.startOnTimelineUs + c.durationUs,
    );
    if (!clip) continue;

    layers.push({
      assetHash: clip.assetHash,
      zIndex: track.zIndex,
      opacity: clip.opacity ?? 1,
      transform: clip.transform ?? identityTransform(),
      inPointUs: clip.inPointUs,
      startOnTimelineUs: clip.startOnTimelineUs,
    });
  }

  return layers;
}
