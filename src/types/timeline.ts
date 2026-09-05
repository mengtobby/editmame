/**
 * CRDT timeline schema.
 *
 * Tracks and clips are stored as FLAT, id-keyed collections (Y.Map<id, Y.Map<field, value>>)
 * rather than as Y.Array elements. Two consequences fall out of that choice:
 *
 *  - Reordering is expressed as a field write (`order`), not a structural move, so it never
 *    conflicts with a concurrent sibling insert/delete the way Y.Array index shifts can.
 *  - Every field on a clip/track is an independent CRDT register. Two peers dragging the same
 *    clip concurrently (one changing `startOnTimelineUs`, the other `trackId`) both survive the
 *    merge instead of one whole-object write clobbering the other.
 */

/**
 * Lexicographically sortable string produced by fractional indexing (see
 * `src/crdt/fractional-index.ts`). A new position can always be generated between any two
 * existing keys, so inserting or reordering never requires rewriting sibling indices.
 */
export type FractionalIndex = string;

export type TrackKind = "video" | "audio";

export interface TrackRecord {
  id: string;
  kind: TrackKind;
  name: string;
  order: FractionalIndex;
  muted: boolean;
  locked: boolean;
  hidden: boolean;
  /** Video compositing stack order among video tracks; higher paints on top. Unused for audio. */
  zIndex: number;
}

export interface ClipTransform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotationDeg: number;
}

export interface ClipRecord {
  id: string;
  trackId: string;
  /** Hex-encoded BLAKE3 merkle root of the source asset — see AssetManifest in wire-protocol.ts. */
  assetHash: string;
  /** Trim in-point within the source asset, in microseconds. */
  inPointUs: number;
  /** Trim out-point within the source asset, in microseconds. */
  outPointUs: number;
  /** Position of the clip's leading edge on the project timeline, in microseconds. */
  startOnTimelineUs: number;
  /** Redundant with (outPointUs - inPointUs) except while a trim drag is in flight locally;
   *  kept as its own field so the two ends of a trim can be edited by different peers without
   *  either write depending on reading the other first. */
  durationUs: number;
  /** Tie-break ordering among clips that overlap on the same track (e.g. transition stacking). */
  order: FractionalIndex;
  label?: string;
  volumeDb?: number;
  opacity?: number;
  transform?: ClipTransform;
}

export interface ProjectMeta {
  id: string;
  name: string;
  frameRateNum: number;
  frameRateDen: number;
  widthPx: number;
  heightPx: number;
  createdAtMs: number;
}

/** Names of the root maps on the shared Y.Doc, as used with `ydoc.getMap(name)`. */
export const Y_ROOT = {
  META: "meta",
  TRACKS: "tracks",
  CLIPS: "clips",
} as const;

/** Plain-object mirror of the Y.Doc contents, e.g. for snapshotting or serialization. */
export interface TimelineDocShape {
  meta: ProjectMeta;
  tracks: Record<string, TrackRecord>;
  clips: Record<string, ClipRecord>;
}

/** Read-only, UI-facing view of a track with its clips already resolved and ordered. */
export interface TrackWithClips extends TrackRecord {
  clips: ClipRecord[];
}

/**
 * Typed surface over the underlying Y.Doc. Implementations (see `src/crdt/timeline-doc.ts`)
 * translate these calls into field-level Yjs transactions so concurrent edits merge per-field
 * rather than per-object.
 */
export interface TimelineEngine {
  getMeta(): ProjectMeta;
  updateMeta(patch: Partial<Omit<ProjectMeta, "id">>): void;

  addTrack(track: Omit<TrackRecord, "order"> & { order?: FractionalIndex }): TrackRecord;
  removeTrack(trackId: string): void;
  reorderTrack(trackId: string, beforeId: string | null, afterId: string | null): void;
  updateTrack(trackId: string, patch: Partial<Omit<TrackRecord, "id">>): void;

  addClip(clip: Omit<ClipRecord, "order"> & { order?: FractionalIndex }): ClipRecord;
  removeClip(clipId: string): void;
  moveClip(clipId: string, patch: Pick<Partial<ClipRecord>, "trackId" | "startOnTimelineUs">): void;
  trimClip(
    clipId: string,
    patch: Pick<Partial<ClipRecord>, "inPointUs" | "outPointUs" | "startOnTimelineUs" | "durationUs">,
  ): void;
  updateClip(clipId: string, patch: Partial<Omit<ClipRecord, "id">>): void;

  getTracksOrdered(): TrackWithClips[];
  getClip(clipId: string): ClipRecord | undefined;

  /** Fires after any local or remote transaction that changed timeline state. */
  subscribe(listener: () => void): () => void;

  toJSON(): TimelineDocShape;
}
