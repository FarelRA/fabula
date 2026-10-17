import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { assertSceneAccess, requireScene } from "./lib/authz";
import { logAction } from "./actions";

/**
 * Branch metadata + switching (PLAN §6, Phase 1.3).
 * Switching the active branch is pure navigation: the active path defines
 * memory/context (L5), nothing is regenerated, nothing is destroyed.
 */

export const list = query({
  args: { sceneId: v.id("scenes") },
  handler: async (ctx, { sceneId }) => {
    const scene = await requireScene(ctx, sceneId);
    await assertSceneAccess(ctx, scene);
    const branches = await ctx.db
      .query("branches")
      .withIndex("by_scene", (q) => q.eq("sceneId", sceneId))
      .collect();
    const beats = await ctx.db
      .query("beats")
      .withIndex("by_scene_seq", (q) => q.eq("sceneId", sceneId))
      .collect();
    const counts = new Map<string, number>();
    for (const beat of beats) {
      const key = beat.branchId as string;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return branches
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((branch) => ({
        ...branch,
        beatCount: counts.get(branch._id as string) ?? 0,
        isActive: branch._id === scene.activeBranchId,
      }));
  },
});

export const setActive = mutation({
  args: { sceneId: v.id("scenes"), tipBeatId: v.id("beats") },
  returns: v.object({ branchId: v.id("branches") }),
  handler: async (ctx, { sceneId, tipBeatId }) => {
    const scene = await requireScene(ctx, sceneId);
    await assertSceneAccess(ctx, scene, { write: true });
    const tip = await ctx.db.get(tipBeatId);
    if (!tip || tip.sceneId !== sceneId) {
      throw new Error("Tip beat not found in this scene");
    }
    await ctx.db.patch(sceneId, { activeBranchId: tip.branchId, activeTipBeatId: tip._id });
    return { branchId: tip.branchId };
  },
});

export const rename = mutation({
  args: { branchId: v.id("branches"), label: v.string() },
  handler: async (ctx, { branchId, label }) => {
    const branch = await ctx.db.get(branchId);
    if (!branch) throw new Error("Branch not found");
    const scene = await requireScene(ctx, branch.sceneId);
    const userId = await assertSceneAccess(ctx, scene, { write: true });
    await ctx.db.patch(branchId, { label });
    await logAction(ctx, {
      sceneId: scene._id,
      type: "branch.rename",
      payload: { branchId, label },
      inverse: { kind: "patchBranch", branchId, patch: { label: branch.label } },
      userId,
    });
  },
});
