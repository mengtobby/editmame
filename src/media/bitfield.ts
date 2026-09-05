import type { Bitfield, Blake3Hex } from "@/types/wire-protocol";

export function createEmptyBitfield(assetHash: Blake3Hex, chunkCount: number): Bitfield {
  return { assetHash, chunkCount, bits: new Uint8Array(Math.ceil(chunkCount / 8)) };
}

export function hasChunk(bitfield: Bitfield, index: number): boolean {
  const byte = bitfield.bits[index >> 3] ?? 0;
  return (byte & (1 << (index & 7))) !== 0;
}

export function setChunk(bitfield: Bitfield, index: number): void {
  const byteIndex = index >> 3;
  const current = bitfield.bits[byteIndex] ?? 0;
  bitfield.bits[byteIndex] = current | (1 << (index & 7));
}

export function isComplete(bitfield: Bitfield): boolean {
  for (let i = 0; i < bitfield.chunkCount; i += 1) {
    if (!hasChunk(bitfield, i)) return false;
  }
  return true;
}

export function missingChunkIndices(bitfield: Bitfield): number[] {
  const missing: number[] = [];
  for (let i = 0; i < bitfield.chunkCount; i += 1) {
    if (!hasChunk(bitfield, i)) missing.push(i);
  }
  return missing;
}

export function countAvailable(bitfield: Bitfield): number {
  let count = 0;
  for (let i = 0; i < bitfield.chunkCount; i += 1) {
    if (hasChunk(bitfield, i)) count += 1;
  }
  return count;
}
