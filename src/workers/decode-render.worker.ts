import { createFile, DataStream, type ArrayBufferWithFileStart, type MP4File } from "mp4box";
import { selectFrameForTime, type TimedFrame } from "@/playback/frame-selector";
import { PlaybackClock } from "@/playback/playback-clock";
import { WebGLCompositor, type CompositeLayer } from "@/playback/webgl-compositor";
import { mapToSourceTimeUs, type MainToWorkerMessage, type RenderableClip, type WorkerToMainMessage } from "./worker-messages";

declare const self: DedicatedWorkerGlobalScope;

interface DecodedSource {
  assetHash: string;
  decoder: VideoDecoder;
  frameQueue: TimedFrame<VideoFrame>[];
  width: number;
  height: number;
}

const sources = new Map<string, DecodedSource>();
const lastFrames = new Map<string, VideoFrame>();
const clock = new PlaybackClock();

let compositor: WebGLCompositor | null = null;
let visibleClips: RenderableClip[] = [];
let renderIntervalHandle: ReturnType<typeof setInterval> | null = null;

function post(message: WorkerToMainMessage): void {
  self.postMessage(message);
}

/**
 * Extracts the raw avcC/hvcC/vpcC/av1C codec-description bytes VideoDecoder needs, by asking
 * mp4box to re-serialize the parsed box and stripping its 8-byte header (size + fourcc) — this
 * is the standard approach used by the WebCodecs sample apps, since mp4box only exposes the box
 * as a parsed object, not as raw bytes.
 */
function extractDescription(mp4boxFile: MP4File, trackId: number): Uint8Array {
  const track = mp4boxFile.getTrackById(trackId);
  const entry = track.mdia.minf.stbl.stsd.entries[0];
  const box = entry?.avcC ?? entry?.hvcC ?? entry?.vpcC ?? entry?.av1C;
  if (!box) throw new Error("No codec description box found (avcC/hvcC/vpcC/av1C)");

  const stream = new DataStream(undefined, 0, DataStream.BIG_ENDIAN);
  box.write(stream);
  return new Uint8Array(stream.buffer, 8);
}

function loadSource(assetHash: string, data: ArrayBuffer): void {
  const mp4boxFile = createFile();

  mp4boxFile.onError = (error) => post({ type: "error", assetHash, message: error });

  mp4boxFile.onReady = (info) => {
    const videoTrack = info.tracks.find((t) => t.video);
    if (!videoTrack?.video) {
      post({ type: "error", assetHash, message: "No video track found in source" });
      return;
    }

    const decoder = new VideoDecoder({
      output: (frame) => {
        sources.get(assetHash)?.frameQueue.push({ timestampUs: frame.timestamp, frame });
      },
      error: (error) => post({ type: "error", assetHash, message: error.message }),
    });

    decoder.configure({
      codec: videoTrack.codec,
      codedWidth: videoTrack.video.width,
      codedHeight: videoTrack.video.height,
      description: extractDescription(mp4boxFile, videoTrack.id),
    });

    sources.set(assetHash, {
      assetHash,
      decoder,
      frameQueue: [],
      width: videoTrack.video.width,
      height: videoTrack.video.height,
    });

    mp4boxFile.onSamples = (_trackId, _user, samples) => {
      const source = sources.get(assetHash);
      if (!source) return;
      for (const sample of samples) {
        source.decoder.decode(
          new EncodedVideoChunk({
            type: sample.is_rap ? "key" : "delta",
            timestamp: (sample.cts / sample.timescale) * 1_000_000,
            duration: (sample.duration / sample.timescale) * 1_000_000,
            data: sample.data,
          }),
        );
      }
    };
    mp4boxFile.setExtractionOptions(videoTrack.id, null, { nbSamples: 100 });
    mp4boxFile.start();

    post({
      type: "source-loaded",
      assetHash,
      durationUs: (info.duration / info.timescale) * 1_000_000,
      width: videoTrack.video.width,
      height: videoTrack.video.height,
    });
  };

  const buffer = data as ArrayBufferWithFileStart;
  buffer.fileStart = 0;
  mp4boxFile.appendBuffer(buffer);
  mp4boxFile.flush();
}

/** Fixed-interval render loop: dedicated workers have no cross-browser requestAnimationFrame,
 *  so a ~60Hz timer drives compositing instead. Each visible clip holds onto its last displayed
 *  frame so playback doesn't blank out on ticks where the decoder hasn't produced a new one yet. */
function renderTick(): void {
  if (!compositor) return;
  const mediaTimeUs = clock.getMediaTimeUs();
  const layers: CompositeLayer[] = [];

  for (const clip of visibleClips) {
    const source = sources.get(clip.assetHash);
    if (!source) continue;

    const sourceTimeUs = mapToSourceTimeUs(clip, mediaTimeUs);
    const { frame, dropped } = selectFrameForTime(source.frameQueue, sourceTimeUs);
    for (const stale of dropped) stale.close();

    if (frame) {
      lastFrames.get(clip.assetHash)?.close();
      lastFrames.set(clip.assetHash, frame);
    }

    const displayFrame = frame ?? lastFrames.get(clip.assetHash);
    if (!displayFrame) continue;

    layers.push({
      source: displayFrame,
      zIndex: clip.zIndex,
      opacity: clip.opacity,
      transform: clip.transform,
      sourceWidth: source.width,
      sourceHeight: source.height,
    });
  }

  compositor.render(layers);
  post({ type: "frame-rendered", mediaTimeUs });
}

self.onmessage = (event: MessageEvent<MainToWorkerMessage>) => {
  const message = event.data;
  switch (message.type) {
    case "init":
      compositor = new WebGLCompositor(message.canvas);
      renderIntervalHandle = setInterval(renderTick, 1000 / 60);
      post({ type: "ready" });
      break;
    case "load-source":
      loadSource(message.assetHash, message.data);
      break;
    case "play":
      clock.play();
      break;
    case "pause":
      clock.pause();
      break;
    case "seek":
      clock.seek(message.mediaTimeUs);
      break;
    case "set-rate":
      clock.setRate(message.rate);
      break;
    case "set-clips":
      visibleClips = message.clips;
      break;
    default:
      break;
  }
};

self.addEventListener("close", () => {
  if (renderIntervalHandle !== null) clearInterval(renderIntervalHandle);
  for (const source of sources.values()) source.decoder.close();
  for (const frame of lastFrames.values()) frame.close();
  compositor?.dispose();
});
