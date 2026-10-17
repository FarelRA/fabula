import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { assertSceneAccess, requireScene } from "./lib/authz";
import { nowMs } from "./lib/time";
import { ensureInitialRevisions } from "./cast";
import { logAction } from "./actions";
import { planEditFork, planRegenerate } from "./domain/branchPlans";
import { projectPath } from "./lib/path";

/**
 * Beats — the narrative tree (PLAN §5, §6, Phase 1.3).
 * `createBeatRow` is the single DB-level append primitive used by every
 * mutation that grows the tree; it owns seq allocation, depth, and branch tip
 * maintenance so the invariants hold in exactly one place.
 */

export async function createBeatRow(
  ctx: MutationCtx,
  args: {
    scene: Doc<"scenes">;
    branchId: Id<"branches">;
    parentBeatId?: Id<"beats">;
    origin: "opening" | "turn" | "option" | "userInsert" | "edit" | "regenerate";
    speakerRoleId?: Id<"roles">;
    text: string;
    status?: "streaming" | "finished" | "failed" | "aborted";
    isArtifact?: boolean;
    editedFromBeatId?: Id<"beats">;
    regenerateOfBeatId?: Id<"beats">;
  },
): Promise<{ beatId: Id<"beats">; seq: number }> {
  const seq = args.scene.seqCounter + 1;
  await ctx.db.patch(args.scene._id, { seqCounter: seq });

  let depth = 0;
  if (args.parentBeatId) {
    const parent = await ctx.db.get(args.parentBeatId);
    if (!parent || parent.sceneId !== args.scene._id) {
      throw new Error("Parent beat not found in scene");
    }
    depth = parent.depth + 1;
  }

  const beatId = await ctx.db.insert("beats", {
    sceneId: args.scene._id,
    branchId: args.branchId,
    parentBeatId: args.parentBeatId,
    seq,
    depth,
    speakerRoleId: args.speakerRoleId,
    origin: args.origin,
    status: args.status ?? "finished",
    isArtifact: args.isArtifact ?? false,
    text: args.text,
    editedFromBeatId: args.editedFromBeatId,
    regenerateOfBeatId: args.regenerateOfBeatId,
    isPinned: false,
    createdAt: nowMs(),
  });

  await ctx.db.patch(args.branchId, { tipBeatId: beatId });
  return { beatId, seq };
}

async function nextColorIndex(ctx: MutationCtx, sceneId: Id<"scenes">): Promise<number> {
  const branches = await ctx.db
    .query("branches")
    .withIndex("by_scene", (q) => q.eq("sceneId", sceneId))
    .collect();
  return branches.length % 8;
}

export const appendOpening = mutation({
  args: {
    sceneId: v.id("scenes"),
    speakerRoleId: v.optional(v.id("roles")),
    text: v.string(),
  },
  returns: v.object({ beatId: v.id("beats"), seq: v.number() }),
  handler: async (ctx, args) => {
    const scene = await requireScene(ctx, args.sceneId);
    await assertSceneAccess(ctx, scene, { write: true });
    if (scene.activeTipBeatId !== undefined) {
      throw new Error("Opening beat already exists");
    }
    const branchId = scene.activeBranchId;
    if (!branchId) throw new Error("Scene has no mainline branch");
    const { beatId, seq } = await createBeatRow(ctx, {
      scene,
      branchId,
      origin: "opening",
      speakerRoleId: args.speakerRoleId,
      text: args.text,
    });
    await ctx.db.patch(scene._id, {
      activeTipBeatId: beatId,
      status: scene.status === "draft" ? "playing" : scene.status,
    });
    await ensureInitialRevisions(ctx, scene, beatId, seq);
    return { beatId, seq };
  },
});

export const appendUserBeat = mutation({
  args: {
    sceneId: v.id("scenes"),
    speakerRoleId: v.optional(v.id("roles")),
    text: v.string(),
  },
  returns: v.object({ beatId: v.id("beats"), seq: v.number() }),
  handler: async (ctx, args) => {
    const scene = await requireScene(ctx, args.sceneId);
    await assertSceneAccess(ctx, scene, { write: true });
    const branchId = scene.activeBranchId;
    if (!branchId) throw new Error("Scene has no mainline branch");
    const { beatId, seq } = await createBeatRow(ctx, {
      scene,
      branchId,
      parentBeatId: scene.activeTipBeatId,
      origin: "userInsert",
      speakerRoleId: args.speakerRoleId,
      text: args.text,
    });
    await ctx.db.patch(scene._id, { activeTipBeatId: beatId });
    return { beatId, seq };
  },
});

export const editFork = mutation({
  args: { beatId: v.id("beats"), newText: v.string() },
  returns: v.object({ newBeatId: v.id("beats"), branchId: v.id("branches") }),
  handler: async (ctx, { beatId, newText }) => {
    const beat = await ctx.db.get(beatId);
    if (!beat) throw new Error("Beat not found");
    const scene = await requireScene(ctx, beat.sceneId);
    const userId = await assertSceneAccess(ctx, scene, { write: true });

    const plan = planEditFork({
      id: beat._id,
      parentBeatId: beat.parentBeatId ?? undefined,
      branchId: beat.branchId,
    });

    const branchId = await ctx.db.insert("branches", {
      sceneId: scene._id,
      label: `Alternate · beat ${beat.seq}`,
      forkedFromBeatId: plan.forkedFromBeatId as Id<"beats"> | undefined,
      forkedFromBranchId: beat.branchId,
      forkReason: plan.forkReason,
      createdByUserId: userId,
      colorIndex: await nextColorIndex(ctx, scene._id),
      createdAt: nowMs(),
    });

    const { beatId: newBeatId } = await createBeatRow(ctx, {
      scene,
      branchId,
      parentBeatId: beat.parentBeatId,
      origin: "edit",
      speakerRoleId: beat.speakerRoleId,
      text: newText,
      editedFromBeatId: beat._id,
    });

    await ctx.db.patch(scene._id, { activeBranchId: branchId, activeTipBeatId: newBeatId });
    await logAction(ctx, {
      sceneId: scene._id,
      type: "beat.editFork",
      payload: { beatId, newBeatId, branchId },
      inverse: {
        kind: "restoreActive",
        branchId: scene.activeBranchId,
        tipBeatId: scene.activeTipBeatId,
      },
      userId,
    });
    return { newBeatId, branchId };
  },
});

export const regenerateFork = mutation({
  args: { beatId: v.id("beats"), text: v.optional(v.string()) },
  returns: v.object({ newBeatId: v.id("beats"), branchId: v.id("branches") }),
  handler: async (ctx, { beatId, text }) => {
    const beat = await ctx.db.get(beatId);
    if (!beat) throw new Error("Beat not found");
    const scene = await requireScene(ctx, beat.sceneId);
    const userId = await assertSceneAccess(ctx, scene, { write: true });

    const plan = planRegenerate({
      id: beat._id,
      parentBeatId: beat.parentBeatId ?? undefined,
      branchId: beat.branchId,
    });

    const branchId = await ctx.db.insert("branches", {
      sceneId: scene._id,
      label: `Alternate · beat ${beat.seq}`,
      forkedFromBeatId: plan.forkedFromBeatId as Id<"beats"> | undefined,
      forkedFromBranchId: beat.branchId,
      forkReason: plan.forkReason,
      createdByUserId: userId,
      colorIndex: await nextColorIndex(ctx, scene._id),
      createdAt: nowMs(),
    });

    const { beatId: newBeatId } = await createBeatRow(ctx, {
      scene,
      branchId,
      parentBeatId: beat.parentBeatId,
      origin: "regenerate",
      speakerRoleId: beat.speakerRoleId,
      text: text ?? "",
      status: text === undefined ? "streaming" : "finished",
      regenerateOfBeatId: beat._id,
    });

    await ctx.db.patch(scene._id, { activeBranchId: branchId, activeTipBeatId: newBeatId });
    await logAction(ctx, {
      sceneId: scene._id,
      type: "beat.regenerateFork",
      payload: { beatId, newBeatId, branchId },
      inverse: {
        kind: "restoreActive",
        branchId: scene.activeBranchId,
        tipBeatId: scene.activeTipBeatId,
      },
      userId,
    });
    return { newBeatId, branchId };
  },
});

export const pin = mutation({
  args: { beatId: v.id("beats"), pinned: v.boolean() },
  handler: async (ctx, { beatId, pinned }) => {
    const beat = await ctx.db.get(beatId);
    if (!beat) throw new Error("Beat not found");
    const scene = await requireScene(ctx, beat.sceneId);
    const userId = await assertSceneAccess(ctx, scene, { write: true });
    await ctx.db.patch(beatId, { isPinned: pinned });
    await logAction(ctx, {
      sceneId: scene._id,
      type: pinned ? "beat.pin" : "beat.unpin",
      payload: { beatId },
      inverse: { kind: "patchBeat", beatId, patch: { isPinned: beat.isPinned } },
      userId,
    });
  },
});

/** Aborted/discarded generations become artifacts; this canonizes one (L6). */
export const keepArtifact = mutation({
  args: { beatId: v.id("beats") },
  handler: async (ctx, { beatId }) => {
    const beat = await ctx.db.get(beatId);
    if (!beat) throw new Error("Beat not found");
    const scene = await requireScene(ctx, beat.sceneId);
    const userId = await assertSceneAccess(ctx, scene, { write: true });
    await ctx.db.patch(beatId, { isArtifact: false, status: "finished" });
    await logAction(ctx, {
      sceneId: scene._id,
      type: "beat.keepArtifact",
      payload: { beatId },
      inverse: { kind: "patchBeat", beatId, patch: { isArtifact: true, status: beat.status } },
      userId,
    });
  },
});

export const listPath = query({
  args: { sceneId: v.id("scenes"), limit: v.optional(v.number()) },
  handler: async (ctx, { sceneId, limit }) => {
    const scene = await requireScene(ctx, sceneId);
    await assertSceneAccess(ctx, scene);
    const projection = await projectPath(ctx, scene);
    const take = limit ?? 100;
    return {
      beats: projection.chain.slice(-take),
      factsCount: projection.facts.length,
      summariesCount: projection.summaries.length,
    };
  },
});

export const getWithOptions = query({
  args: { beatId: v.id("beats") },
  handler: async (ctx, { beatId }) => {
    const beat = await ctx.db.get(beatId);
    if (!beat) return null;
    const scene = await requireScene(ctx, beat.sceneId);
    await assertSceneAccess(ctx, scene);
    const options = await ctx.db
      .query("candidates")
      .withIndex("by_parent_status", (q) => q.eq("parentBeatId", beatId).eq("status", "offered"))
      .collect();
    return { beat, options: options.sort((a, b) => a.optionIndex - b.optionIndex) };
  },
});
