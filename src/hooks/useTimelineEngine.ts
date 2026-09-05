import { useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import * as Y from "yjs";
import { TimelineDoc } from "@/crdt/timeline-doc";
import type { ProjectMeta, TrackWithClips } from "@/types/timeline";

export interface UseTimelineEngineResult {
  engine: TimelineDoc;
  tracks: TrackWithClips[];
  meta: ProjectMeta;
}

/**
 * Bridges TimelineDoc (a plain Yjs wrapper) into React via useSyncExternalStore. The snapshot is
 * cached and only recomputed when the engine actually notifies of a change — getTracksOrdered()
 * builds fresh arrays/objects every call, and returning a new reference on every render (even
 * when nothing changed) would trip React's "getSnapshot should be cached" tearing check.
 */
export function useTimelineEngine(ydoc: Y.Doc, initialMeta: ProjectMeta): UseTimelineEngineResult {
  const engine = useMemo(() => new TimelineDoc(ydoc, initialMeta), [ydoc, initialMeta]);
  const cacheRef = useRef<{ tracks: TrackWithClips[]; meta: ProjectMeta } | null>(null);

  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      engine.subscribe(() => {
        cacheRef.current = null;
        onStoreChange();
      }),
    [engine],
  );

  const getSnapshot = useCallback(() => {
    if (!cacheRef.current) {
      cacheRef.current = { tracks: engine.getTracksOrdered(), meta: engine.getMeta() };
    }
    return cacheRef.current;
  }, [engine]);

  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  return { engine, tracks: snapshot.tracks, meta: snapshot.meta };
}
