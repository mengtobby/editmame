import { describe, expect, it } from "vitest";
import { InMemoryChunkStore } from "./chunk-store";

describe("InMemoryChunkStore", () => {
  it("stores and retrieves a chunk by (assetHash, chunkIndex)", async () => {
    const store = new InMemoryChunkStore();
    const data = new Uint8Array([1, 2, 3]);

    expect(await store.hasChunk("asset-1", 0)).toBe(false);
    await store.putChunk("asset-1", 0, data);
    expect(await store.hasChunk("asset-1", 0)).toBe(true);
    expect(await store.getChunk("asset-1", 0)).toEqual(data);
  });

  it("builds a bitfield reflecting only the chunks that have been written", async () => {
    const store = new InMemoryChunkStore();
    await store.putChunk("asset-1", 0, new Uint8Array([1]));
    await store.putChunk("asset-1", 2, new Uint8Array([3]));

    const bitfield = await store.getBitfield("asset-1", 4);
    expect(bitfield.chunkCount).toBe(4);

    const { hasChunk } = await import("@/media/bitfield");
    expect(hasChunk(bitfield, 0)).toBe(true);
    expect(hasChunk(bitfield, 1)).toBe(false);
    expect(hasChunk(bitfield, 2)).toBe(true);
    expect(hasChunk(bitfield, 3)).toBe(false);
  });

  it("keeps separate assets isolated from each other", async () => {
    const store = new InMemoryChunkStore();
    await store.putChunk("asset-1", 0, new Uint8Array([1]));
    expect(await store.hasChunk("asset-2", 0)).toBe(false);
  });

  it("deleteAsset removes all chunks for that asset only", async () => {
    const store = new InMemoryChunkStore();
    await store.putChunk("asset-1", 0, new Uint8Array([1]));
    await store.putChunk("asset-2", 0, new Uint8Array([2]));

    await store.deleteAsset("asset-1");

    expect(await store.hasChunk("asset-1", 0)).toBe(false);
    expect(await store.hasChunk("asset-2", 0)).toBe(true);
  });

  it("returns undefined for a chunk that was never written", async () => {
    const store = new InMemoryChunkStore();
    expect(await store.getChunk("asset-1", 5)).toBeUndefined();
  });
});
