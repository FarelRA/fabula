import { internalMutation, query } from "../_generated/server";
import { v } from "convex/values";
import { nowMs } from "../lib/time";
import { generationModeV } from "../lib/validators";
import { assertSceneAccess, requireScene } from "../lib/authz";

/**
 * Prompt provenance: every generation writes a snapshot with its
 * compiled blocks (text + hashes + template versions) and token accounting.
 * The prompt inspector reads these rows.
 */

export const write = internalMutation({
  args: {
    sceneId: v.id("scenes"),
    mode: generationModeV,
    beatId: v.optional(v.id("beats")),
    candidateId: v.optional(v.id("candidates")),
    roleId: v.optional(v.id("roles")),
    blocks: v.array(
      v.object({
        key: v.string(),
        templateKey: v.optional(v.string()),
        templateVersion: v.optional(v.number()),
        text: v.string(),
        hash: v.string(),
        tokens: v.number(),
        chars: v.number(),
      }),
    ),
    model: v.object({
      provider: v.string(),
      modelId: v.string(),
      params: v.any(),
    }),
    tokenCounts: v.object({
      system: v.number(),
      context: v.number(),
      outputReserve: v.number(),
      total: v.number(),
    }),
    budget: v.object({
      contextWindow: v.number(),
      systemTargetPct: v.number(),
      overBudgetAction: v.optional(v.string()),
    }),
  },
  returns: v.id("promptSnapshots"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("promptSnapshots", {
      sceneId: args.sceneId,
      mode: args.mode,
      beatId: args.beatId,
      candidateId: args.candidateId,
      roleId: args.roleId,
      blocks: args.blocks,
      model: args.model,
      tokenCounts: args.tokenCounts,
      budget: args.budget,
      createdAt: nowMs(),
    });
  },
});

/**
 * Prompt inspector reads. Snapshots store rendered
 * block text at write time, so the inspector shows exactly what was compiled
 * even after templates or revisions change.
 */
export const getForBeat = query({
  args: { beatId: v.id("beats") },
  handler: async (ctx, { beatId }) => {
    const beat = await ctx.db.get(beatId);
    if (!beat) return null;
    const scene = await requireScene(ctx, beat.sceneId);
    await assertSceneAccess(ctx, scene);
    const rows = await ctx.db
      .query("promptSnapshots")
      .withIndex("by_beat", (q) => q.eq("beatId", beatId))
      .collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const getForCandidate = query({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, { candidateId }) => {
    const candidate = await ctx.db.get(candidateId);
    if (!candidate) return null;
    const scene = await requireScene(ctx, candidate.sceneId);
    await assertSceneAccess(ctx, scene);
    // Option batches link through candidates.promptSnapshotId; the
    // by_candidate index covers any future per-candidate snapshots.
    if (candidate.promptSnapshotId) {
      const linked = await ctx.db.get(candidate.promptSnapshotId);
      if (linked) return [linked];
    }
    const rows = await ctx.db
      .query("promptSnapshots")
      .withIndex("by_candidate", (q) => q.eq("candidateId", candidateId))
      .collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/** Recent-generation index for the inspector's fallback view. */
export const listForScene = query({
  args: { sceneId: v.id("scenes"), limit: v.optional(v.number()) },
  handler: async (ctx, { sceneId, limit }) => {
    const scene = await requireScene(ctx, sceneId);
    await assertSceneAccess(ctx, scene);
    return await ctx.db
      .query("promptSnapshots")
      .withIndex("by_scene_createdAt", (q) => q.eq("sceneId", sceneId))
      .order("desc")
      .take(limit ?? 8);
  },
});
