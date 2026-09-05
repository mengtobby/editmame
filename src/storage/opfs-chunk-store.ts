import type { Bitfield, Blake3Hex } from "@/types/wire-protocol";
import { createEmptyBitfield, setChunk } from "@/media/bitfield";
import type { ChunkStore } from "./chunk-store";

function chunkFileName(chunkIndex: number): string {
  return `chunk-${chunkIndex}`;
}

/**
 * OPFS-backed chunk cache: one directory per asset (named by its BLAKE3 hash), one file per
 * chunk. OPFS gives us durable storage that survives reloads without ever round-tripping media
 * through a server — chunks arrive over WebRTC (or from a local import) and land here directly.
 */
export class OPFSChunkStore implements ChunkStore {
  private rootHandle: Promise<FileSystemDirectoryHandle> | null = null;

  private getRoot(): Promise<FileSystemDirectoryHandle> {
    if (!this.rootHandle) {
      this.rootHandle = navigator.storage.getDirectory();
    }
    return this.rootHandle;
  }

  private async getAssetDir(assetHash: Blake3Hex, create: boolean): Promise<FileSystemDirectoryHandle> {
    const root = await this.getRoot();
    return root.getDirectoryHandle(assetHash, { create });
  }

  async hasChunk(assetHash: Blake3Hex, chunkIndex: number): Promise<boolean> {
    try {
      const dir = await this.getAssetDir(assetHash, false);
      await dir.getFileHandle(chunkFileName(chunkIndex));
      return true;
    } catch {
      return false;
    }
  }

  async putChunk(assetHash: Blake3Hex, chunkIndex: number, data: Uint8Array<ArrayBuffer>): Promise<void> {
    const dir = await this.getAssetDir(assetHash, true);
    const fileHandle = await dir.getFileHandle(chunkFileName(chunkIndex), { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(data);
    await writable.close();
  }

  async getChunk(assetHash: Blake3Hex, chunkIndex: number): Promise<Uint8Array<ArrayBuffer> | undefined> {
    try {
      const dir = await this.getAssetDir(assetHash, false);
      const fileHandle = await dir.getFileHandle(chunkFileName(chunkIndex));
      const file = await fileHandle.getFile();
      return new Uint8Array(await file.arrayBuffer());
    } catch {
      return undefined;
    }
  }

  async getBitfield(assetHash: Blake3Hex, chunkCount: number): Promise<Bitfield> {
    const bitfield = createEmptyBitfield(assetHash, chunkCount);
    try {
      const dir = await this.getAssetDir(assetHash, false);
      for await (const name of dir.keys()) {
        const match = /^chunk-(\d+)$/.exec(name);
        if (match?.[1]) setChunk(bitfield, Number(match[1]));
      }
    } catch {
      // Directory doesn't exist yet — no chunks available, empty bitfield is correct.
    }
    return bitfield;
  }

  async deleteAsset(assetHash: Blake3Hex): Promise<void> {
    const root = await this.getRoot();
    try {
      await root.removeEntry(assetHash, { recursive: true });
    } catch {
      // Already absent.
    }
  }
}

export function isOPFSSupported(): boolean {
  return typeof navigator !== "undefined" && "storage" in navigator && "getDirectory" in navigator.storage;
}
