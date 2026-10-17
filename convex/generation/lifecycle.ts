import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { createBeatRow } from "../beats";
import { ensureInitialRevisions } from "../cast";
import { nowMs } from "../lib/time";
import { recordUsageRow } from "../usage";
import { snapshotV } from "./validators";

/**
 * Beat lifecycle for streamed generations (PLAN §8.5):
 *  - beginBeat: creates the beat on the FIRST delta (failure before any
 *    output leaves no beat row — the tree can never be corrupted).
 *  - completeRun: persists the snapshot, finalizes the beat (canon / artifact /
 *    failed), moves pointers only for canon output, records usage, closes the
 *    run. Aborted-discarded output becomes an artifact that never moves the
 *    active tip (law L6: nothing is destroyed).
 */

export type RunOutcome = "done" | "failed" | "aborted";

export const beginBeat = internalMutation({
  args: {
    sceneId: v.id("scenes"),
    runId: v.id("generationRuns"),
    roleId: v.optional(v.id("roles")),
    parentBeatId: v.optional(v.id("beats")),
    opening: v.boolean(),
  },
  returns: v.object({ beatId: v.id("beats"), branchId: v.id("branches") }),
  handler: async (ctx, args) => {
    const scene = await ctx.db.get(args.sceneId);
    if (!scene) throw new Error("Scene not found");
    let branchId = scene.activeBranchId;
    if (args.parentBeatId) {
      const parent = await ctx.db.get(args.parentBeatId);
      if (!parent || parent.sceneId !== scene._id) throw new Error("Parent beat not found");
      branchId = parent.branchId;
    }
    if (!branchId) throw new Error("Scene has no branch to write into");
    const { beatId } = await createBeatRow(ctx, {
      scene,
      branchId,
      parentBeatId: args.parentBeatId,
      origin: args.opening ? "opening" : "turn",
      speakerRoleId: args.roleId,
      text: "",
      status: "streaming",
      setBranchTip: false,
    });
    await ctx.db.patch(beatId, { runId: args.runId });
    return { beatId, branchId };
  },
});

export const completeRun = internalMutation({
  args: {
    sceneId: v.id("scenes"),
    runId: v.id("generationRuns"),
    beatId: v.optional(v.id("beats")),
    text: v.string(),
    outcome: v.union(v.literal("done"), v.literal("failed"), v.literal("aborted")),
    keepPartial: v.boolean(),
    opening: v.boolean(),
    model: v.optional(v.string()),
    streamMessageId: v.optional(v.string()),
    tier: v.optional(v.string()),
    provider: v.optional(v.string()),
    modelId: v.optional(v.string()),
    tokensIn: v.number(),
    tokensOut: v.number(),
    snapshot: snapshotV,
    roleId: v.optional(v.id("roles")),
  },
  returns: v.object({
    canonized: v.boolean(),
    snapshotId: v.id("promptSnapshots"),
  }),
  handler: async (ctx, args) => {
    const scene = await ctx.db.get(args.sceneId);
    if (!scene) throw new Error("Scene not found");

    const snapshotId = await ctx.db.insert("promptSnapshots", {
      sceneId: args.sceneId,
      mode: args.snapshot.mode,
      beatId: args.beatId,
      roleId: args.roleId,
      blocks: args.snapshot.blocks,
      model: args.snapshot.model,
      tokenCounts: args.snapshot.tokenCounts,
      budget: args.snapshot.budget,
      createdAt: nowMs(),
    });

    let canonized = false;
    if (args.beatId) {
      const beat = await ctx.db.get(args.beatId);
      if (!beat) throw new Error("Beat not found");
      const isDone = args.outcome === "done";
      const keepAbortedPartial = args.outcome === "aborted" && args.keepPartial;
      const status: Doc<"beats">["status"] = isDone || keepAbortedPartial
        ? "finished"
        : args.outcome === "aborted"
          ? "aborted"
          : "failed";
      const isArtifact = args.outcome === "aborted" && !args.keepPartial;
      canonized = isDone || keepAbortedPartial;

      await ctx.db.patch(args.beatId, {
        text: args.text,
        status,
        isArtifact,
        promptSnapshotId: snapshotId,
        model: args.model,
        streamMessageId: args.streamMessageId,
        tokensIn: args.tokensIn,
        tokensOut: args.tokensOut,
      });

      if (canonized) {
        const parentMatchesTip =
          scene.activeTipBeatId === beat.parentBeatId ||
          (args.opening && scene.activeTipBeatId === undefined);
        if (parentMatchesTip) {
          await ctx.db.patch(args.sceneId, {
            activeTipBeatId: args.beatId,
            activeBranchId: beat.branchId,
            status: args.opening && scene.status === "draft" ? "playing" : scene.status,
          });
          await ctx.db.patch(beat.branchId, { tipBeatId: args.beatId });
          if (args.opening) {
            await ensureInitialRevisions(ctx, scene, args.beatId, beat.seq);
          }
        }
      }
    }

    if (args.provider && args.modelId && (args.tokensIn > 0 || args.tokensOut > 0)) {
      await recordUsageRow(ctx, {
        sceneId: args.sceneId,
        tier: args.tier ?? "spotlight",
        provider: args.provider,
        modelId: args.modelId,
        kind: args.snapshot.mode,
        tokensIn: args.tokensIn,
        tokensOut: args.tokensOut,
      });
    }

    const run = await ctx.db.get(args.runId);
    if (run && run.status === "running") {
      await ctx.db.patch(args.runId, {
        status: args.outcome,
        finishedAt: nowMs(),
      });
    }

    return { canonized, snapshotId };
  },
});
