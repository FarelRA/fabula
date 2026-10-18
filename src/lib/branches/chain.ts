/**
 * Path reconstruction for read-only surfaces (archive replay, exports).
 * Walks parent links from a branch tip; cycle-bounded, returns root → tip.
 * Operates on Convex doc-shaped rows (`_id` + `parentBeatId`).
 */

export type ChainDoc = { _id: string; parentBeatId?: string };

export function chainForDocs<T extends ChainDoc>(
  tipId: string | undefined,
  beats: readonly T[],
): T[] {
  const byId = new Map(beats.map((beat) => [beat._id, beat]));
  const chain: T[] = [];
  const seen = new Set<string>();
  let current = tipId ? byId.get(tipId) : undefined;
  while (current && !seen.has(current._id)) {
    seen.add(current._id);
    chain.push(current);
    current = current.parentBeatId
      ? byId.get(current.parentBeatId)
      : undefined;
  }
  return chain.reverse();
}
