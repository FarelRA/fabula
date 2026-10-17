import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { assertSceneAccess, requireScene } from "./lib/authz";
import { nowMs } from "./lib/time";
import { createBeatRow } from "./beats";
import { logAction } from "./actions";
import { planPick } from "./domain/branchPlans";

/**
 * Path options (candidates) — PLAN §6, laws L1–L3.
 * Candidates are created by the options generation action (Phase 2) or by
 * tests; picking one either extends the active branch (parent is the active
 * tip) or forks a new branch from the parent (ghost pick).
 */

const optionV = v.object({
  label: v.string(),
  speakerRoleId: v.optional(v.id("roles")),
  text: v.string(),
  strategy: v.string(),
});

export const createBatch = mutation({
  args: {
    sceneId: v.id("scenes"),
    parentBeatId: v.id("beats"),
    options: v.array(optionV),
  },
  returns: v.array(v.id("candidates")),
  handler: async (ctx, args) => {
    const scene = await requireScene(ctx, args.sceneId);
    await assertSceneAccess(ctx, scene, { write: true });
    if (args.options.length < 1 || args.options.length > 4) {
      throw new Error("A decision point carries 1–4 options");
    }
    const parent = await ctx.db.get(args.parentBeatId);
    if (!parent || parent.sceneId !== args.sceneId) {
      throw new Error("Parent beat not found in this scene");
    }
    const ids: Id<"candidates">[] = [];
    for (let i = 0; i < args.options.length; i += 1) {
      const option = args.options[i];
      if (!option) continue;
      ids.push(
        await ctx.db.insert("candidates", {
          sceneId: args.sceneId,
          parentBeatId: args.parentBeatId,
          branchId: parent.branchId, // context in which the option was offered
          optionIndex: i + 1,
          label: option.label,
          speakerRoleId: option.speakerRoleId,
          text: option.text,
          strategy: option.strategy,
          status: "offered",
          createdAt: nowMs(),
        }),
      );
    }
    return ids;
  },
});

export const pick = mutation({
  args: { candidateId: v.id("candidates") },
  returns: v.object({
    beatId: v.id("beats"),
    branchId: v.id("branches"),
    forked: v.boolean(),
  }),
  handler: async (ctx, { candidateId }) => {
    const candidate = await ctx.db.get(candidateId);
    if (!candidate) throw new Error("Candidate not found");
    if (candidate.status !== "offered") throw new Error("Candidate already resolved");
    const scene = await requireScene(ctx, candidate.sceneId);
    const userId = await assertSceneAccess(ctx, scene, { write: true });

    const plan = planPick({
      activeBranchId: scene.activeBranchId ?? undefined,
      activeTipBeatId: scene.activeTipBeatId ?? undefined,
      candidateParentBeatId: candidate.parentBeatId,
      candidateBranchId: candidate.branchId,
    });

    let branchId: Id<"branches">;
    if (plan.kind === "extend") {
      branchId = plan.branchId as Id<"branches">;
    } else {
      const parent = await ctx.db.get(plan.forkedFromBeatId as Id<"beats">);
      const branchCount = (
        await ctx.db
          .query("branches")
          .withIndex("by_scene", (q) => q.eq("sceneId", scene._id))
          .collect()
      ).length;
      branchId = await ctx.db.insert("branches", {
        sceneId: scene._id,
        label: `Alternate · beat ${parent ? parent.seq : "?"}`,
        forkedFromBeatId: plan.forkedFromBeatId as Id<"beats">,
        forkedFromBranchId: plan.forkedFromBranchId as Id<"branches">,
        forkReason: "pick",
        createdByUserId: userId,
        colorIndex: branchCount % 8,
        createdAt: nowMs(),
      });
    }

    const { beatId } = await createBeatRow(ctx, {
      scene,
      branchId,
      parentBeatId: candidate.parentBeatId,
      origin: "option",
      speakerRoleId: candidate.speakerRoleId,
      text: candidate.text,
    });

    await ctx.db.patch(candidateId, { status: "picked", pickedBeatId: beatId });
    await ctx.db.patch(scene._id, { activeBranchId: branchId, activeTipBeatId: beatId });
    await logAction(ctx, {
      sceneId: scene._id,
      type: "candidate.pick",
      payload: { candidateId, beatId, branchId, forked: plan.kind === "fork" },
      inverse: {
        kind: "restoreActive",
        branchId: scene.activeBranchId,
        tipBeatId: scene.activeTipBeatId,
        candidateId,
      },
      userId,
    });

    return { beatId, branchId, forked: plan.kind === "fork" };
  },
});

export const dismiss = mutation({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, { candidateId }) => {
    const candidate = await ctx.db.get(candidateId);
    if (!candidate) throw new Error("Candidate not found");
    if (candidate.status !== "offered") throw new Error("Candidate already resolved");
    const scene = await requireScene(ctx, candidate.sceneId);
    const userId = await assertSceneAccess(ctx, scene, { write: true });
    await ctx.db.patch(candidateId, { status: "dismissed" });
    await logAction(ctx, {
      sceneId: scene._id,
      type: "candidate.dismiss",
      payload: { candidateId },
      inverse: { kind: "patchCandidate", candidateId, patch: { status: "offered" } },
      userId,
    });
  },
});

export const listForBeat = query({
  args: { beatId: v.id("beats") },
  handler: async (ctx, { beatId }) => {
    const beat = await ctx.db.get(beatId);
    if (!beat) return null;
    const scene = await requireScene(ctx, beat.sceneId);
    await assertSceneAccess(ctx, scene);
    const rows = await ctx.db
      .query("candidates")
      .withIndex("by_parent_status", (q) => q.eq("parentBeatId", beatId))
      .collect();
    return rows.sort((a, b) => a.optionIndex - b.optionIndex);
  },
});
