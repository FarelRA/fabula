import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

/**
 * Path projection, the single place where branch-scoped context is computed.
 * Everything that needs "the active path" goes through
 * here; the leak test guards that no other code re-implements it.
 */

export type Ctx = QueryCtx | MutationCtx;

export type BeatLike = {
  _id: string;
  parentBeatId?: string;
  seq: number;
  branchId: string;
};

export type FactLike = {
  nodeId: string;
  isPinned: boolean;
  status: string;
};

export type SummaryLike = {
  coveredThroughSeq: number;
};

/** Walk parent links from the tip up to the root. Throws on cycles. */
export function buildChain(beats: BeatLike[], tipId?: string): BeatLike[] {
  if (!tipId) return [];
  const byId = new Map(beats.map((b) => [b._id, b]));
  const chain: BeatLike[] = [];
  const seen = new Set<string>();
  let current: string | undefined = tipId;
  while (current !== undefined) {
    if (seen.has(current)) {
      throw new Error("Cycle detected in beat ancestry");
    }
    seen.add(current);
    const beat = byId.get(current);
    if (!beat) {
      throw new Error(`Beat ${current} not found while walking the active path`);
    }
    chain.push(beat);
    current = beat.parentBeatId;
  }
  return chain.reverse();
}

export function pathSets(chain: BeatLike[]): { ids: Set<string>; seqs: Set<number> } {
  return {
    ids: new Set(chain.map((b) => b._id)),
    seqs: new Set(chain.map((b) => b.seq)),
  };
}

/**
 * Facts on the active path. Explicitly pinned facts are scene-global canon
 * overrides and are included regardless of path; muted facts are
 * never included.
 */
export function filterFactsAlongPath<T extends FactLike>(facts: T[], ids: Set<string>): T[] {
  return facts.filter(
    (fact) => fact.status === "active" && (fact.isPinned || ids.has(fact.nodeId)),
  );
}

/** Summaries apply iff the beat they end on is on the active path. */
export function filterSummariesAlongPath<T extends SummaryLike>(
  summaries: T[],
  seqs: Set<number>,
): T[] {
  return summaries.filter((summary) => seqs.has(summary.coveredThroughSeq));
}

// ---------------------------------------------------------------------------
// DB-backed projection
// ---------------------------------------------------------------------------

export async function sceneBeats(ctx: Ctx, sceneId: Id<"scenes">): Promise<Doc<"beats">[]> {
  return await ctx.db
    .query("beats")
    .withIndex("by_scene_seq", (q) => q.eq("sceneId", sceneId))
    .collect();
}

export async function activeChain(
  ctx: Ctx,
  scene: Doc<"scenes">,
  tipBeatId?: Id<"beats">,
): Promise<Doc<"beats">[]> {
  const beats = await sceneBeats(ctx, scene._id);
  const chain = buildChain(beats, tipBeatId ?? scene.activeTipBeatId ?? undefined);
  const byId = new Map(beats.map((b) => [b._id as string, b]));
  return chain.map((entry) => {
    const doc = byId.get(entry._id);
    if (!doc) throw new Error(`Beat ${entry._id} vanished from the scene`);
    return doc;
  });
}

export type PathProjection = {
  chain: Doc<"beats">[];
  facts: Doc<"facts">[];
  summaries: Doc<"summaries">[];
};

export async function projectPath(
  ctx: Ctx,
  scene: Doc<"scenes">,
  tipBeatId?: Id<"beats">,
): Promise<PathProjection> {
  const chain = await activeChain(ctx, scene, tipBeatId);
  const { ids, seqs } = pathSets(chain);

  const factsRaw = await ctx.db
    .query("facts")
    .withIndex("by_scene_status", (q) => q.eq("sceneId", scene._id).eq("status", "active"))
    .collect();
  const facts = filterFactsAlongPath(factsRaw, ids);

  const summariesRaw = await ctx.db
    .query("summaries")
    .withIndex("by_scene_coveredThroughSeq", (q) => q.eq("sceneId", scene._id))
    .order("desc")
    .collect();
  const summaries = filterSummariesAlongPath(summariesRaw, seqs);

  return { chain, facts, summaries };
}

/** Latest role revision effective at (or before) the given scene seq. */
export async function revisionAt(
  ctx: Ctx,
  roleId: Id<"roles">,
  seq: number,
): Promise<Doc<"roleRevisions"> | null> {
  return await ctx.db
    .query("roleRevisions")
    .withIndex("by_role_effectiveSeq", (q) => q.eq("roleId", roleId).lte("effectiveSeq", seq))
    .order("desc")
    .first();
}
