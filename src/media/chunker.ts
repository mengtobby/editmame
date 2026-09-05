import { CHUNK_SIZE_BYTES, type AssetManifest, type Blake3Hex } from "@/types/wire-protocol";
import { hashHex, merkleRootHex } from "./blake3";

export interface ChunkedAsset {
  manifest: AssetManifest;
  /** Index-aligned with manifest.chunkHashes. */
  chunks: Uint8Array<ArrayBuffer>[];
}

/** Slices a locally-imported file into fixed-size chunks and hashes each one, without ever
 *  uploading the file anywhere — this is the only place raw file bytes are touched before they
 *  become content-addressed chunks. */
export async function chunkFile(file: Blob, fileName: string): Promise<ChunkedAsset> {
  const chunkCount = Math.max(1, Math.ceil(file.size / CHUNK_SIZE_BYTES));
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  const chunkHashes: Blake3Hex[] = [];

  for (let index = 0; index < chunkCount; index += 1) {
    const start = index * CHUNK_SIZE_BYTES;
    const end = Math.min(start + CHUNK_SIZE_BYTES, file.size);
    const bytes = new Uint8Array(await file.slice(start, end).arrayBuffer());
    chunks.push(bytes);
    chunkHashes.push(hashHex(bytes));
  }

  const manifest: AssetManifest = {
    assetHash: merkleRootHex(chunkHashes),
    fileName,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    chunkCount,
    chunkHashes,
  };

  return { manifest, chunks };
}
