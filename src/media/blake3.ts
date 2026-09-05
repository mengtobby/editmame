import { blake3 } from "@noble/hashes/blake3";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import type { Blake3Hex } from "@/types/wire-protocol";

export function hashHex(data: Uint8Array<ArrayBuffer>): Blake3Hex {
  return bytesToHex(blake3(data));
}

/**
 * Two-level Merkle root over per-chunk BLAKE3 leaf hashes: concatenate the leaves and hash the
 * result. Distinct from BLAKE3's own internal tree (which operates on 1KiB sub-chunks); this
 * root is over our own 1MiB wire chunks so a manifest's `assetHash` changes if and only if the
 * chunk layout or content changes.
 */
export function merkleRootHex(chunkHashes: Blake3Hex[]): Blake3Hex {
  const concatenated = new Uint8Array(chunkHashes.length * 32);
  chunkHashes.forEach((hex, i) => concatenated.set(hexToBytes(hex), i * 32));
  return hashHex(concatenated);
}

export function verifyChunk(data: Uint8Array<ArrayBuffer>, expectedHash: Blake3Hex): boolean {
  return hashHex(data) === expectedHash;
}
