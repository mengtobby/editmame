export interface VideoMeta {
  durationUs: number;
  width: number;
  height: number;
}

/** Reads duration/dimensions via a throwaway <video> element — cheap and immediate, unlike
 *  waiting for the full mp4box + WebCodecs demux pipeline just to place a clip on the timeline. */
export function probeVideoMeta(file: File): Promise<VideoMeta> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);

    const cleanup = () => URL.revokeObjectURL(url);

    video.preload = "metadata";
    video.onloadedmetadata = () => {
      resolve({
        durationUs: Math.round(video.duration * 1_000_000),
        width: video.videoWidth,
        height: video.videoHeight,
      });
      cleanup();
    };
    video.onerror = () => {
      cleanup();
      reject(new Error(`Failed to read video metadata for ${file.name}`));
    };
    video.src = url;
  });
}
