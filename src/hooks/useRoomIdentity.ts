import { useCallback, useEffect, useRef, useState } from "react";

function readRoomIdFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get("room");
}

/** Room id lives in the URL's ?room= query param so refreshing or sharing the link rejoins the
 *  same session; peer id is a random per-tab identity that never changes for the tab's lifetime. */
export function useRoomIdentity(): { roomId: string; peerId: string; regenerateRoom: () => void } {
  const [roomId, setRoomId] = useState(() => readRoomIdFromUrl() ?? crypto.randomUUID());
  const peerIdRef = useRef<string | null>(null);
  if (peerIdRef.current === null) peerIdRef.current = crypto.randomUUID();

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("room", roomId);
    window.history.replaceState(null, "", url.toString());
  }, [roomId]);

  const regenerateRoom = useCallback(() => setRoomId(crypto.randomUUID()), []);

  return { roomId, peerId: peerIdRef.current, regenerateRoom };
}
