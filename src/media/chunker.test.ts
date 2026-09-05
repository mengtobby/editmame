import { describe, expect, it } from "vitest";
import { CHUNK_SIZE_BYTES } from "@/types/wire-protocol";
import { chunkFile } from "./chunker";
import { verifyChunk } from "./blake3";

function randomBytes(size: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(size);
  for (let i = 0; i < size; i += 1) bytes[i] = (i * 2654435761) % 256;
  return bytes;
}

describe("chunkFile", () => {
  it("splits a file into CHUNK_SIZE_BYTES pieces and hashes each one", async () => {
    const size = CHUNK_SIZE_BYTES * 2 + 1234;
    const bytes = randomBytes(size);
    const file = new Blob([bytes], { type: "video/mp4" });

    const { manifest, chunks } = await chunkFile(file, "clip.mp4");

    expect(manifest.chunkCount).toBe(3);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(CHUNK_SIZE_BYTES);
    expect(chunks[1]).toHaveLength(CHUNK_SIZE_BYTES);
    expect(chunks[2]).toHaveLength(1234);
    expect(manifest.sizeBytes).toBe(size);
    expect(manifest.mimeType).toBe("video/mp4");

    chunks.forEach((chunk, i) => {
      expect(verifyChunk(chunk, manifest.chunkHashes[i]!)).toBe(true);
    });
  });

  it("produces a deterministic assetHash for identical content", async () => {
    const bytes = randomBytes(500_000);
    const fileA = new Blob([bytes]);
    const fileB = new Blob([bytes]);

    const { manifest: a } = await chunkFile(fileA, "a.mp4");
    const { manifest: b } = await chunkFile(fileB, "b.mp4");

    expect(a.assetHash).toBe(b.assetHash);
  });

  it("produces a different assetHash when content differs", async () => {
    const { manifest: a } = await chunkFile(new Blob([randomBytes(1000)]), "a.mp4");
    const { manifest: b } = await chunkFile(new Blob([randomBytes(1001)]), "b.mp4");

    expect(a.assetHash).not.toBe(b.assetHash);
  });

  it("handles an empty file as a single empty chunk", async () => {
    const { manifest, chunks } = await chunkFile(new Blob([]), "empty.mp4");
    expect(manifest.chunkCount).toBe(1);
    expect(chunks[0]).toHaveLength(0);
  });

  it("flags corrupted chunk data against the manifest hash", async () => {
    const { manifest, chunks } = await chunkFile(new Blob([randomBytes(1000)]), "a.mp4");
    const corrupted = new Uint8Array(chunks[0]!);
    corrupted[0] = (corrupted[0]! + 1) % 256;
    expect(verifyChunk(corrupted, manifest.chunkHashes[0]!)).toBe(false);
  });
});
