import { useCallback, useRef, useState } from "react";

function readRoomIdFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get("room");
}

function writeRoomIdToUrl(roomId: string): void {
  const url = new URL(window.location.href);
  if (url.searchParams.get("room") === roomId) return;
  url.searchParams.set("room", roomId);
  window.history.replaceState(null, "", url.toString());
}

/**
 * Room id lives in the URL's ?room= query param so refreshing or sharing the link rejoins the
 * same session; peer id is a random per-tab identity that never changes for the tab's lifetime.
 *
 * The URL write happens synchronously inside the state initializer, not in a useEffect: a
 * useEffect only runs after the first paint, so anything reading location.href before then (a
 * fast automated client, or another tab opened by copying the address bar mid-navigation) would
 * see a URL without the room id and generate an unrelated one instead of joining the same room.
 * It's idempotent, so React StrictMode's double-invocation of this initializer in development
 * doesn't double-write: the second call sees the room id the first one already wrote and skips it.
 */
export function useRoomIdentity(): { roomId: string; peerId: string; regenerateRoom: () => void } {
  const [roomId, setRoomId] = useState(() => {
    const existing = readRoomIdFromUrl();
    const resolved = existing ?? crypto.randomUUID();
    writeRoomIdToUrl(resolved);
    return resolved;
  });
  const peerIdRef = useRef<string | null>(null);
  if (peerIdRef.current === null) peerIdRef.current = crypto.randomUUID();

  const regenerateRoom = useCallback(() => {
    const next = crypto.randomUUID();
    writeRoomIdToUrl(next);
    setRoomId(next);
  }, []);

  return { roomId, peerId: peerIdRef.current, regenerateRoom };
}
