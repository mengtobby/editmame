import * as Y from "yjs";
import {
  Y_ROOT,
  type ClipRecord,
  type FractionalIndex,
  type ProjectMeta,
  type TimelineDocShape,
  type TimelineEngine,
  type TrackRecord,
  type TrackWithClips,
} from "@/types/timeline";
import { compareOrdered, keyBetween } from "./fractional-index";

type YEntityMap = Y.Map<unknown>;

/**
 * Yjs-backed implementation of TimelineEngine.
 *
 * Tracks and clips each live as their own nested Y.Map inside a root Y.Map keyed by id
 * (`ydoc.getMap("tracks").get(trackId)` is itself a Y.Map). That nesting is what gives us
 * per-field merge semantics: setting `startOnTimelineUs` on a clip and setting `trackId` on the
 * same clip from two different peers are two independent CRDT register writes, so both survive
 * a merge. If clips were plain JS objects stored as values, one peer's write would silently
 * replace the other's.
 */
export class TimelineDoc implements TimelineEngine {
  readonly ydoc: Y.Doc;
  private readonly ymeta: Y.Map<unknown>;
  private readonly ytracks: Y.Map<YEntityMap>;
  private readonly yclips: Y.Map<YEntityMap>;

  constructor(ydoc: Y.Doc = new Y.Doc(), initialMeta?: ProjectMeta) {
    this.ydoc = ydoc;
    this.ymeta = ydoc.getMap(Y_ROOT.META);
    this.ytracks = ydoc.getMap(Y_ROOT.TRACKS);
    this.yclips = ydoc.getMap(Y_ROOT.CLIPS);

    if (initialMeta && this.ymeta.size === 0) {
      this.ydoc.transact(() => {
        for (const [key, value] of Object.entries(initialMeta)) {
          this.ymeta.set(key, value);
        }
      });
    }
  }

  // ---- meta ----

  getMeta(): ProjectMeta {
    return Object.fromEntries(this.ymeta.entries()) as unknown as ProjectMeta;
  }

  updateMeta(patch: Partial<Omit<ProjectMeta, "id">>): void {
    this.ydoc.transact(() => {
      for (const [key, value] of Object.entries(patch)) {
        this.ymeta.set(key, value);
      }
    });
  }

  // ---- tracks ----

  addTrack(track: Omit<TrackRecord, "order"> & { order?: FractionalIndex }): TrackRecord {
    const order = track.order ?? this.nextTrackOrder();
    const record: TrackRecord = { ...track, order };

    this.ydoc.transact(() => {
      const ymap = new Y.Map<unknown>();
      for (const [key, value] of Object.entries(record)) {
        ymap.set(key, value);
      }
      this.ytracks.set(record.id, ymap);
    });

    return record;
  }

  removeTrack(trackId: string): void {
    this.ydoc.transact(() => {
      this.ytracks.delete(trackId);
      for (const [clipId, yclip] of this.yclips.entries()) {
        if (yclip.get("trackId") === trackId) {
          this.yclips.delete(clipId);
        }
      }
    });
  }

  reorderTrack(trackId: string, beforeId: string | null, afterId: string | null): void {
    const before = beforeId ? (this.ytracks.get(beforeId)?.get("order") as FractionalIndex | undefined) : null;
    const after = afterId ? (this.ytracks.get(afterId)?.get("order") as FractionalIndex | undefined) : null;
    const order = keyBetween(before, after);

    this.ydoc.transact(() => {
      this.ytracks.get(trackId)?.set("order", order);
    });
  }

  updateTrack(trackId: string, patch: Partial<Omit<TrackRecord, "id">>): void {
    const ymap = this.ytracks.get(trackId);
    if (!ymap) return;
    this.ydoc.transact(() => {
      for (const [key, value] of Object.entries(patch)) {
        ymap.set(key, value);
      }
    });
  }

  // ---- clips ----

  addClip(clip: Omit<ClipRecord, "order"> & { order?: FractionalIndex }): ClipRecord {
    const order = clip.order ?? this.nextClipOrder(clip.trackId);
    const record: ClipRecord = { ...clip, order };

    this.ydoc.transact(() => {
      const ymap = new Y.Map<unknown>();
      for (const [key, value] of Object.entries(record)) {
        if (value !== undefined) ymap.set(key, value);
      }
      this.yclips.set(record.id, ymap);
    });

    return record;
  }

  removeClip(clipId: string): void {
    this.ydoc.transact(() => {
      this.yclips.delete(clipId);
    });
  }

  moveClip(clipId: string, patch: Pick<Partial<ClipRecord>, "trackId" | "startOnTimelineUs">): void {
    this.updateClip(clipId, patch);
  }

  trimClip(
    clipId: string,
    patch: Pick<Partial<ClipRecord>, "inPointUs" | "outPointUs" | "startOnTimelineUs" | "durationUs">,
  ): void {
    this.updateClip(clipId, patch);
  }

  updateClip(clipId: string, patch: Partial<Omit<ClipRecord, "id">>): void {
    const ymap = this.yclips.get(clipId);
    if (!ymap) return;
    this.ydoc.transact(() => {
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined) continue;
        ymap.set(key, value);
      }
    });
  }

  getClip(clipId: string): ClipRecord | undefined {
    const ymap = this.yclips.get(clipId);
    return ymap ? (Object.fromEntries(ymap.entries()) as unknown as ClipRecord) : undefined;
  }

  // ---- reads ----

  getTracksOrdered(): TrackWithClips[] {
    const tracks: TrackRecord[] = [];
    for (const ymap of this.ytracks.values()) {
      tracks.push(Object.fromEntries(ymap.entries()) as unknown as TrackRecord);
    }
    tracks.sort(compareOrdered);

    const clipsByTrack = new Map<string, ClipRecord[]>();
    for (const ymap of this.yclips.values()) {
      const clip = Object.fromEntries(ymap.entries()) as unknown as ClipRecord;
      const bucket = clipsByTrack.get(clip.trackId);
      if (bucket) bucket.push(clip);
      else clipsByTrack.set(clip.trackId, [clip]);
    }
    for (const clips of clipsByTrack.values()) {
      clips.sort(compareOrdered);
    }

    return tracks.map((track) => ({ ...track, clips: clipsByTrack.get(track.id) ?? [] }));
  }

  subscribe(listener: () => void): () => void {
    this.ytracks.observeDeep(listener);
    this.yclips.observeDeep(listener);
    this.ymeta.observe(listener);
    return () => {
      this.ytracks.unobserveDeep(listener);
      this.yclips.unobserveDeep(listener);
      this.ymeta.unobserve(listener);
    };
  }

  toJSON(): TimelineDocShape {
    const tracks: Record<string, TrackRecord> = {};
    for (const [id, ymap] of this.ytracks.entries()) {
      tracks[id] = Object.fromEntries(ymap.entries()) as unknown as TrackRecord;
    }
    const clips: Record<string, ClipRecord> = {};
    for (const [id, ymap] of this.yclips.entries()) {
      clips[id] = Object.fromEntries(ymap.entries()) as unknown as ClipRecord;
    }
    return { meta: this.getMeta(), tracks, clips };
  }

  // ---- helpers ----

  private nextTrackOrder(): FractionalIndex {
    let last: FractionalIndex | null = null;
    for (const ymap of this.ytracks.values()) {
      const order = ymap.get("order") as FractionalIndex;
      if (last === null || order > last) last = order;
    }
    return keyBetween(last, null);
  }

  private nextClipOrder(trackId: string): FractionalIndex {
    let last: FractionalIndex | null = null;
    for (const ymap of this.yclips.values()) {
      if (ymap.get("trackId") !== trackId) continue;
      const order = ymap.get("order") as FractionalIndex;
      if (last === null || order > last) last = order;
    }
    return keyBetween(last, null);
  }
}
