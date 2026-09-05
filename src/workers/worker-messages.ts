import type { ClipTransform } from "@/types/timeline";

/** One decoded-and-composited layer to draw this frame, in ascending zIndex order. */
export interface RenderableClip {
  assetHash: string;
  zIndex: number;
  opacity: number;
  transform: ClipTransform;
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
