import { useCallback, useEffect, useRef, useState } from "react";
import type { MainToWorkerMessage, RenderableClip, WorkerToMainMessage } from "@/workers/worker-messages";

export interface PlaybackWorkerApi {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isPlaying: boolean;
  currentTimeUs: number;
  lastError: string | null;
  play: () => void;
  pause: () => void;
  seek: (mediaTimeUs: number) => void;
  setClips: (clips: RenderableClip[]) => void;
  loadSource: (assetHash: string, data: ArrayBuffer) => void;
}

/** Owns the decode/render worker's lifecycle: transfers the canvas to it once on mount, and
 *  exposes a small imperative API (play/pause/seek/setClips/loadSource) that just posts typed
 *  messages across — all actual decoding and compositing happens off the main thread. */
export function usePlaybackWorker(): PlaybackWorkerApi {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const terminateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeUs, setCurrentTimeUs] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // A canvas can have transferControlToOffscreen() called on it exactly once, ever — but
    // React StrictMode deliberately runs this effect's mount/cleanup/mount twice in
    // development. Deferring the actual worker teardown lets the immediate re-mount cancel it
    // and reuse the existing worker instead of trying (and failing) to transfer the same
    // canvas again.
    if (terminateTimeoutRef.current !== null) {
      clearTimeout(terminateTimeoutRef.current);
      terminateTimeoutRef.current = null;
    }

    if (!workerRef.current) {
      const worker = new Worker(new URL("../workers/decode-render.worker.ts", import.meta.url), { type: "module" });
      workerRef.current = worker;

      worker.onmessage = (event: MessageEvent<WorkerToMainMessage>) => {
        const message = event.data;
        if (message.type === "frame-rendered") setCurrentTimeUs(message.mediaTimeUs);
        else if (message.type === "error") setLastError(message.message);
      };

      const offscreen = canvas.transferControlToOffscreen();
      const init: MainToWorkerMessage = { type: "init", canvas: offscreen };
      worker.postMessage(init, [offscreen]);
    }

    return () => {
      terminateTimeoutRef.current = setTimeout(() => {
        workerRef.current?.terminate();
        workerRef.current = null;
      }, 0);
    };
  }, []);

  const play = useCallback(() => {
    workerRef.current?.postMessage({ type: "play" } satisfies MainToWorkerMessage);
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    workerRef.current?.postMessage({ type: "pause" } satisfies MainToWorkerMessage);
    setIsPlaying(false);
  }, []);

  const seek = useCallback((mediaTimeUs: number) => {
    workerRef.current?.postMessage({ type: "seek", mediaTimeUs } satisfies MainToWorkerMessage);
    setCurrentTimeUs(mediaTimeUs);
  }, []);

  const setClips = useCallback((clips: RenderableClip[]) => {
    workerRef.current?.postMessage({ type: "set-clips", clips } satisfies MainToWorkerMessage);
  }, []);

  const loadSource = useCallback((assetHash: string, data: ArrayBuffer) => {
    workerRef.current?.postMessage({ type: "load-source", assetHash, data } satisfies MainToWorkerMessage, [data]);
  }, []);

  return { canvasRef, isPlaying, currentTimeUs, lastError, play, pause, seek, setClips, loadSource };
}
