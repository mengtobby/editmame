import { generateKeyBetween, generateNKeysBetween } from "fractional-indexing";
import type { FractionalIndex } from "@/types/timeline";

/**
 * Generates a key that sorts between `before` and `after` (either may be null/undefined for
 * "start of list" / "end of list"). Used for both track order and clip order so inserting or
 * reordering an item never touches any other item's key.
 */
export function keyBetween(
  before: FractionalIndex | null | undefined,
  after: FractionalIndex | null | undefined,
): FractionalIndex {
  return generateKeyBetween(before ?? null, after ?? null);
}

export function keysBetween(
  before: FractionalIndex | null | undefined,
  after: FractionalIndex | null | undefined,
  count: number,
): FractionalIndex[] {
  return generateNKeysBetween(before ?? null, after ?? null, count);
}

/** Sorts by `order` field, breaking ties by `id` so concurrent inserts at the same key still
 *  produce a deterministic (if arbitrary) order across all peers. */
export function compareOrdered<T extends { order: FractionalIndex; id: string }>(a: T, b: T): number {
  if (a.order < b.order) return -1;
  if (a.order > b.order) return 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
