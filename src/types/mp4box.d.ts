/**
 * mp4box.js ships no TypeScript types and no @types package exists. This declares only the
 * subset of its API this project uses (see node_modules/mp4box/README.md for the full surface).
 */
declare module "mp4box" {
  export interface MP4VideoTrackInfo {
    width: number;
    height: number;
  }

  export interface MP4TrackInfo {
    id: number;
    codec: string;
    timescale: number;
    duration: number;
    nb_samples: number;
    video?: MP4VideoTrackInfo;
    audio?: { sample_rate: number; channel_count: number; sample_size: number };
  }

  export interface MP4Info {
    duration: number;
    timescale: number;
    isFragmented: boolean;
    tracks: MP4TrackInfo[];
  }

  export interface MP4Sample {
    track_id: number;
    is_rap: boolean;
    timescale: number;
    dts: number;
    cts: number;
    duration: number;
    size: number;
    data: ArrayBuffer;
  }

  export interface MP4Box {
    write(stream: MP4DataStream): void;
  }

  export interface MP4SampleEntry {
    avcC?: MP4Box;
    hvcC?: MP4Box;
    vpcC?: MP4Box;
    av1C?: MP4Box;
  }

  export interface MP4TrakBox {
    mdia: { minf: { stbl: { stsd: { entries: MP4SampleEntry[] } } } };
  }

  export interface MP4DataStream {
    buffer: ArrayBuffer;
  }

  export interface MP4DataStreamConstructor {
    new (buffer?: ArrayBuffer, byteOffset?: number, endianness?: boolean): MP4DataStream;
    BIG_ENDIAN: boolean;
  }

  export interface ArrayBufferWithFileStart extends ArrayBuffer {
    fileStart: number;
  }

  export interface MP4File {
    onReady?: (info: MP4Info) => void;
    onSamples?: (trackId: number, user: unknown, samples: MP4Sample[]) => void;
    onError?: (error: string) => void;
    appendBuffer(data: ArrayBufferWithFileStart): number;
    start(): void;
    stop(): void;
    flush(): void;
    setExtractionOptions(trackId: number, user?: unknown, options?: { nbSamples?: number }): void;
    getTrackById(trackId: number): MP4TrakBox;
  }

  export function createFile(): MP4File;

  export const DataStream: MP4DataStreamConstructor;
}
