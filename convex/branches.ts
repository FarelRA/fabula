import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { assertSceneAccess, assertSceneMutable, requireScene } from "./lib/authz";
import { logAction } from "./actions";
import { projectPath } from "./lib/path";

/**
 * Branch metadata + switching.
 * Switching the active branch is pure navigation: the active path defines
 * memory/context, nothing is regenerated, nothing is destroyed.
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

/**
 * Full story tree for the branch map. One lazy-loaded
 * payload: branches, every beat (with a text preview), and candidates per
 * decision point. `activeBeatIds` marks the path the director is on.
 */
export const tree = query({
  args: { sceneId: v.id("scenes") },
  handler: async (ctx, { sceneId }) => {
    const scene = await requireScene(ctx, sceneId);
    await assertSceneAccess(ctx, scene);
    const [branches, beats, offered, picked, dismissed, projection] =
      await Promise.all([
        ctx.db
          .query("branches")
          .withIndex("by_scene", (q) => q.eq("sceneId", sceneId))
          .collect(),
        ctx.db
          .query("beats")
          .withIndex("by_scene_seq", (q) => q.eq("sceneId", sceneId))
          .collect(),
        ctx.db
          .query("candidates")
          .withIndex("by_scene_status", (q) =>
            q.eq("sceneId", sceneId).eq("status", "offered"),
          )
          .collect(),
        ctx.db
          .query("candidates")
          .withIndex("by_scene_status", (q) =>
            q.eq("sceneId", sceneId).eq("status", "picked"),
          )
          .collect(),
        ctx.db
          .query("candidates")
          .withIndex("by_scene_status", (q) =>
            q.eq("sceneId", sceneId).eq("status", "dismissed"),
          )
          .collect(),
        projectPath(ctx, scene),
      ]);

    return {
      activeBranchId: scene.activeBranchId,
      activeTipBeatId: scene.activeTipBeatId,
      activeBeatIds: projection.chain.map((beat) => beat._id),
      branches: branches.sort((a, b) => a.createdAt - b.createdAt),
      beats: beats
        .sort((a, b) => a.seq - b.seq)
        .map((beat) => ({
          _id: beat._id,
          branchId: beat.branchId,
          parentBeatId: beat.parentBeatId,
          seq: beat.seq,
          depth: beat.depth,
          speakerRoleId: beat.speakerRoleId,
          origin: beat.origin,
          status: beat.status,
          isArtifact: beat.isArtifact,
          isPinned: beat.isPinned,
          textPreview: beat.text.slice(0, 220),
          textChars: beat.text.length,
          editedFromBeatId: beat.editedFromBeatId,
          regenerateOfBeatId: beat.regenerateOfBeatId,
          createdAt: beat.createdAt,
        })),
      candidates: [...offered, ...picked, ...dismissed].map((candidate) => ({
        _id: candidate._id,
        parentBeatId: candidate.parentBeatId,
        branchId: candidate.branchId,
        optionIndex: candidate.optionIndex,
        label: candidate.label,
        speakerRoleId: candidate.speakerRoleId,
        status: candidate.status,
        pickedBeatId: candidate.pickedBeatId,
      })),
    };
  },
});

export const setActive = mutation({
  args: { sceneId: v.id("scenes"), tipBeatId: v.id("beats") },
  returns: v.object({ branchId: v.id("branches") }),
  handler: async (ctx, { sceneId, tipBeatId }) => {
    const scene = await requireScene(ctx, sceneId);
    await assertSceneAccess(ctx, scene, { write: true });
    assertSceneMutable(scene);
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
    assertSceneMutable(scene);
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
