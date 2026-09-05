import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { TimelineDoc } from "./timeline-doc";
import type { ProjectMeta } from "@/types/timeline";

const meta: ProjectMeta = {
  id: "proj-1",
  name: "Test Project",
  frameRateNum: 30000,
  frameRateDen: 1001,
  widthPx: 1920,
  heightPx: 1080,
  createdAtMs: 0,
};

/** Exchanges full state between two Y.Docs, simulating a WebRTC DataChannel sync round-trip. */
function sync(a: Y.Doc, b: Y.Doc): void {
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
}

function seededPeer(): { doc: TimelineDoc; trackAId: string; trackBId: string; clipId: string } {
  const doc = new TimelineDoc(new Y.Doc(), meta);
  const trackA = doc.addTrack({ id: "track-a", kind: "video", name: "V1", muted: false, locked: false, hidden: false, zIndex: 0 });
  const trackB = doc.addTrack({ id: "track-b", kind: "video", name: "V2", muted: false, locked: false, hidden: false, zIndex: 1 });
  const clip = doc.addClip({
    id: "clip-1",
    trackId: trackA.id,
    assetHash: "a".repeat(64),
    inPointUs: 0,
    outPointUs: 2_000_000,
    startOnTimelineUs: 0,
    durationUs: 2_000_000,
  });
  return { doc, trackAId: trackA.id, trackBId: trackB.id, clipId: clip.id };
}

describe("TimelineDoc conflict resolution", () => {
  it("merges concurrent edits to different fields of the same clip without either being dropped", () => {
    const { doc: docA, trackBId, clipId } = seededPeer();

    // Peer B starts from a synced copy of the same document.
    const docB = new TimelineDoc(new Y.Doc());
    Y.applyUpdate(docB.ydoc, Y.encodeStateAsUpdate(docA.ydoc));

    // Concurrently, before either side has seen the other's change:
    // Peer A drags the clip to a new position on the same track.
    docA.trimClip(clipId, { startOnTimelineUs: 5_000_000 });
    // Peer B drags the clip onto a different track.
    docB.moveClip(clipId, { trackId: trackBId });

    sync(docA.ydoc, docB.ydoc);

    const resultA = docA.getClip(clipId);
    const resultB = docB.getClip(clipId);

    // Both docs converge to an identical state...
    expect(resultA).toEqual(resultB);
    // ...and both concurrent field writes survived the merge (neither clobbered the other).
    expect(resultA?.startOnTimelineUs).toBe(5_000_000);
    expect(resultA?.trackId).toBe(trackBId);
  });

  it("converges deterministically when two peers write the same field concurrently", () => {
    const { doc: docA, clipId } = seededPeer();
    const docB = new TimelineDoc(new Y.Doc());
    Y.applyUpdate(docB.ydoc, Y.encodeStateAsUpdate(docA.ydoc));

    docA.trimClip(clipId, { startOnTimelineUs: 1_000_000 });
    docB.trimClip(clipId, { startOnTimelineUs: 9_000_000 });

    sync(docA.ydoc, docB.ydoc);

    const resultA = docA.getClip(clipId);
    const resultB = docB.getClip(clipId);

    // Yjs's LWW tie-break is deterministic across peers, so both must agree on one winner --
    // which value wins doesn't matter for this test, only that every peer agrees.
    expect(resultA?.startOnTimelineUs).toBe(resultB?.startOnTimelineUs);
    expect([1_000_000, 9_000_000]).toContain(resultA?.startOnTimelineUs);
  });

  it("reorders tracks via fractional indexing without rewriting sibling order fields", () => {
    const { doc, trackAId, trackBId } = seededPeer();
    const before = doc.getTracksOrdered();
    expect(before.map((t) => t.id)).toEqual([trackAId, trackBId]);

    // Move track A to after track B.
    doc.reorderTrack(trackAId, trackBId, null);

    const after = doc.getTracksOrdered();
    expect(after.map((t) => t.id)).toEqual([trackBId, trackAId]);
    // Track B's own order field was never touched by A's move.
    const bBefore = before.find((t) => t.id === trackBId)!;
    const bAfter = after.find((t) => t.id === trackBId)!;
    expect(bAfter.order).toBe(bBefore.order);
  });

  it("removing a track cascades to remove its clips", () => {
    const { doc, trackAId, clipId } = seededPeer();
    doc.removeTrack(trackAId);
    expect(doc.getClip(clipId)).toBeUndefined();
    expect(doc.getTracksOrdered().find((t) => t.id === trackAId)).toBeUndefined();
  });
});
