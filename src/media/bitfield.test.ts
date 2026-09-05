import { describe, expect, it } from "vitest";
import { countAvailable, createEmptyBitfield, hasChunk, isComplete, missingChunkIndices, setChunk } from "./bitfield";

describe("bitfield", () => {
  it("starts empty and reports no chunks available", () => {
    const bf = createEmptyBitfield("hash", 10);
    expect(countAvailable(bf)).toBe(0);
    expect(isComplete(bf)).toBe(false);
    expect(missingChunkIndices(bf)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("sets and reads individual bits across byte boundaries", () => {
    const bf = createEmptyBitfield("hash", 20);
    setChunk(bf, 0);
    setChunk(bf, 7);
    setChunk(bf, 8);
    setChunk(bf, 19);

    expect(hasChunk(bf, 0)).toBe(true);
    expect(hasChunk(bf, 7)).toBe(true);
    expect(hasChunk(bf, 8)).toBe(true);
    expect(hasChunk(bf, 19)).toBe(true);
    expect(hasChunk(bf, 1)).toBe(false);
    expect(hasChunk(bf, 18)).toBe(false);
    expect(countAvailable(bf)).toBe(4);
  });

  it("reports complete once every chunk is set", () => {
    const bf = createEmptyBitfield("hash", 3);
    setChunk(bf, 0);
    setChunk(bf, 1);
    expect(isComplete(bf)).toBe(false);
    setChunk(bf, 2);
    expect(isComplete(bf)).toBe(true);
    expect(missingChunkIndices(bf)).toEqual([]);
  });
});
