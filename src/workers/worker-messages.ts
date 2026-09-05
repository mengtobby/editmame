import type { ClipTransform } from "@/types/timeline";

/** One decoded-and-composited layer to draw this frame, in ascending zIndex order. */
export interface RenderableClip {
  assetHash: string;
  zIndex: number;
  opacity: number;
  transform: ClipTransform;
  /** Trim in-point within the source asset, microseconds — see mapToSourceTimeUs. */
  inPointUs: number;
  /** Where this clip starts on the project timeline, microseconds — see mapToSourceTimeUs. */
  startOnTimelineUs: number;
}

/** Converts the project-timeline clock into this clip's source-relative presentation time, so a
 *  trimmed and/or offset clip decodes and displays the right frame instead of assuming every
 *  clip starts at project time 0 with no trim. */
export function mapToSourceTimeUs(clip: Pick<RenderableClip, "inPointUs" | "startOnTimelineUs">, projectMediaTimeUs: number): number {
  return clip.inPointUs + (projectMediaTimeUs - clip.startOnTimelineUs);
}

export type MainToWorkerMessage =
  | { type: "init"; canvas: OffscreenCanvas }
  | { type: "load-source"; assetHash: string; data: ArrayBuffer }
  | { type: "play" }
  | { type: "pause" }
  | { type: "seek"; mediaTimeUs: number }
  | { type: "set-rate"; rate: number }
  | { type: "set-clips"; clips: RenderableClip[] };

export type WorkerToMainMessage =
  | { type: "ready" }
  | { type: "source-loaded"; assetHash: string; durationUs: number; width: number; height: number }
  | { type: "frame-rendered"; mediaTimeUs: number }
  | { type: "error"; assetHash?: string; message: string };
