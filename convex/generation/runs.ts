import { internalMutation, internalQuery, mutation, query } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { assertSceneAccess, requireScene } from "../lib/authz";
import { nowMs } from "../lib/time";
import { generationModeV } from "../lib/validators";

/**
 * Generation-run lifecycle: one active run per scene
 * (invariant #1), abort requests checked by the streaming loop, watchdog
 * cron fails stale runs. Auto-floor starts are gated here on the scene
 * status, so a burst request that raced a pause cannot land a beat after it.
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
    /** Auto-floor starts only begin while the scene is `playing`. */
    auto?: boolean;
  },
): Promise<Id<"generationRuns"> | null> {
  if (args.auto === true) {
    const scene = await ctx.db.get(args.sceneId);
    if (!scene || scene.status !== "playing") return null;
  }
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
    auto: v.optional(v.boolean()),
  },
  returns: v.union(v.id("generationRuns"), v.null()),
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

/** Close a run when a later setup step (e.g. fork creation) fails. */
export const fail = internalMutation({
  args: { runId: v.id("generationRuns"), error: v.string() },
  handler: async (ctx, { runId, error }) => {
    await ctx.db.patch(runId, {
      status: "failed",
      error,
      finishedAt: nowMs(),
    });
  },
});

/** Public floor state for the play UI. */
export const active = query({
  args: { sceneId: v.id("scenes") },
  handler: async (ctx, { sceneId }) => {
    const scene = await requireScene(ctx, sceneId);
    await assertSceneAccess(ctx, scene);
    const run = await ctx.db
      .query("generationRuns")
      .withIndex("by_scene_status", (q) => q.eq("sceneId", sceneId).eq("status", "running"))
      .first();
    if (!run) return null;
    const role = run.roleId ? await ctx.db.get(run.roleId) : null;
    return {
      _id: run._id,
      mode: run.mode,
      roleId: run.roleId ?? null,
      roleName: role?.identity.name ?? null,
      roleAccent: role?.identity.accentColor ?? null,
      roleMonogram: role?.identity.monogram ?? null,
      startedAt: run.startedAt,
      abortRequested: run.abortRequested,
    };
  },
});
