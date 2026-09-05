import type { ChunkStore } from "@/storage/chunk-store";
import type { AssetManifest } from "@/types/wire-protocol";
import { chunkFile } from "./chunker";
import { probeVideoMeta } from "./probe-video";

export interface ImportedMedia {
  manifest: AssetManifest;
  durationUs: number;
  width: number;
  height: number;
}

/** Chunks a locally-picked file and writes it straight into the local ChunkStore — the file
 *  never leaves the machine. The caller is responsible for announcing the resulting manifest to
 *  the swarm (SwarmPeer.announceLocalAsset) and adding a clip that references its assetHash. */
export async function importMediaFile(file: File, store: ChunkStore): Promise<ImportedMedia> {
  const [{ manifest, chunks }, meta] = await Promise.all([chunkFile(file, file.name), probeVideoMeta(file)]);

  await Promise.all(chunks.map((chunk, index) => store.putChunk(manifest.assetHash, index, chunk)));

  return { manifest, durationUs: meta.durationUs, width: meta.width, height: meta.height };
}
