/**
 * Async iteration on FileSystemDirectoryHandle (`.keys()`/`.values()`/`.entries()`) is
 * implemented by every OPFS-capable browser but isn't yet part of TypeScript's bundled
 * lib.dom.d.ts. This augments the ambient type to match the real runtime API.
 */
export {};

declare global {
  interface FileSystemDirectoryHandle {
    keys(): AsyncIterableIterator<string>;
    values(): AsyncIterableIterator<FileSystemHandle>;
    entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
  }
}
