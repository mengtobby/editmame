import type { Bitfield, Blake3Hex } from "@/types/wire-protocol";
import { createEmptyBitfield, setChunk } from "@/media/bitfield";

/**
 * Content-addressed chunk cache, keyed by (assetHash, chunkIndex). Implementations must never
 * store a chunk that fails BLAKE3 verification against the asset's manifest — that check happens
 * one layer up, in the swarm receive path, before putChunk is ever called.
 */
export interface ChunkStore {
  hasChunk(assetHash: Blake3Hex, chunkIndex: number): Promise<boolean>;
  putChunk(assetHash: Blake3Hex, chunkIndex: number, data: Uint8Array<ArrayBuffer>): Promise<void>;
  getChunk(assetHash: Blake3Hex, chunkIndex: number): Promise<Uint8Array<ArrayBuffer> | undefined>;
  getBitfield(assetHash: Blake3Hex, chunkCount: number): Promise<Bitfield>;
  deleteAsset(assetHash: Blake3Hex): Promise<void>;
}

/** Non-persistent fallback used in tests and any environment without OPFS support. */
export class InMemoryChunkStore implements ChunkStore {
  private assets = new Map<Blake3Hex, Map<number, Uint8Array<ArrayBuffer>>>();

  async hasChunk(assetHash: Blake3Hex, chunkIndex: number): Promise<boolean> {
    return this.assets.get(assetHash)?.has(chunkIndex) ?? false;
  }

  async putChunk(assetHash: Blake3Hex, chunkIndex: number, data: Uint8Array<ArrayBuffer>): Promise<void> {
    let chunks = this.assets.get(assetHash);
    if (!chunks) {
      chunks = new Map();
      this.assets.set(assetHash, chunks);
    }
    chunks.set(chunkIndex, data);
  }

  async getChunk(assetHash: Blake3Hex, chunkIndex: number): Promise<Uint8Array<ArrayBuffer> | undefined> {
    return this.assets.get(assetHash)?.get(chunkIndex);
  }

  async getBitfield(assetHash: Blake3Hex, chunkCount: number): Promise<Bitfield> {
    const bitfield = createEmptyBitfield(assetHash, chunkCount);
    const chunks = this.assets.get(assetHash);
    if (chunks) {
      for (const index of chunks.keys()) setChunk(bitfield, index);
    }
    return bitfield;
  }

  async deleteAsset(assetHash: Blake3Hex): Promise<void> {
    this.assets.delete(assetHash);
  }
}
