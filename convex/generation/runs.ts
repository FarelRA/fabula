import { internalMutation, internalQuery, mutation } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { assertSceneAccess, requireScene } from "../lib/authz";
import { nowMs } from "../lib/time";
import { generationModeV } from "../lib/validators";

/**
 * Generation-run lifecycle (PLAN §8.5, §8.7): one active run per scene
 * (invariant #1), abort requests checked by the streaming loop, watchdog
 * cron fails stale runs.
 */

export async function beginRunRow(
  ctx: MutationCtx,
  args: {
    sceneId: Id<"scenes">;
    branchId: Id<"branches">;
    parentBeatId?: Id<"beats">;
    mode: "turn" | "options" | "casting" | "summary" | "facts" | "directorMeta" | "sampleLine" | "castRegen" | "fieldRegen" | "continuity";
    roleId?: Id<"roles">;
    candidateId?: Id<"candidates">;
  },
): Promise<Id<"generationRuns">> {
  const running = await ctx.db
    .query("generationRuns")
    .withIndex("by_scene_status", (q) => q.eq("sceneId", args.sceneId).eq("status", "running"))
    .first();
  if (running) {
    throw new Error("A generation is already running for this scene");
  }
  return await ctx.db.insert("generationRuns", {
    sceneId: args.sceneId,
    branchId: args.branchId,
    parentBeatId: args.parentBeatId,
    mode: args.mode,
    roleId: args.roleId,
    candidateId: args.candidateId,
    status: "running",
    abortRequested: false,
    attempt: 0,
    startedAt: nowMs(),
  });
}

export const begin = internalMutation({
  args: {
    sceneId: v.id("scenes"),
    branchId: v.id("branches"),
    parentBeatId: v.optional(v.id("beats")),
    mode: generationModeV,
    roleId: v.optional(v.id("roles")),
    candidateId: v.optional(v.id("candidates")),
  },
  returns: v.id("generationRuns"),
  handler: async (ctx, args) => beginRunRow(ctx, args),
});

export async function isRunAborted(ctx: QueryCtx, runId: Id<"generationRuns">): Promise<boolean> {
  const run = await ctx.db.get(runId);
  return run?.abortRequested === true || run?.status !== "running";
}

export const isAborted = internalQuery({
  args: { runId: v.id("generationRuns") },
  returns: v.boolean(),
  handler: async (ctx, { runId }) => isRunAborted(ctx, runId),
});

/** UI abort: cancels the current running generation for a scene. */
export const requestAbort = mutation({
  args: { sceneId: v.id("scenes") },
  returns: v.object({ aborted: v.boolean() }),
  handler: async (ctx, { sceneId }) => {
    const scene = await requireScene(ctx, sceneId);
    await assertSceneAccess(ctx, scene, { write: true });
    const running = await ctx.db
      .query("generationRuns")
      .withIndex("by_scene_status", (q) => q.eq("sceneId", sceneId).eq("status", "running"))
      .first();
    if (!running) return { aborted: false };
    await ctx.db.patch(running._id, { abortRequested: true });
    return { aborted: true };
  },
});

export const statusForScene = internalQuery({
  args: { sceneId: v.id("scenes") },
  handler: async (ctx, { sceneId }) => {
    return await ctx.db
      .query("generationRuns")
      .withIndex("by_scene_status", (q) => q.eq("sceneId", sceneId).eq("status", "running"))
      .first();
  },
});
