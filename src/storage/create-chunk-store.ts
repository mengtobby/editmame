import type { ChunkStore } from "./chunk-store";
import { InMemoryChunkStore } from "./chunk-store";
import { isOPFSSupported, OPFSChunkStore } from "./opfs-chunk-store";

export function createChunkStore(): ChunkStore {
  return isOPFSSupported() ? new OPFSChunkStore() : new InMemoryChunkStore();
}
