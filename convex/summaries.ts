import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { assertSceneAccess, requireScene } from "./lib/authz";
import { nowMs } from "./lib/time";
import { projectPath } from "./lib/path";

/**
 * Rolling summaries. Written by the memory agent (internal),
 * projected along the active path: a summary applies iff the beat it ends on
 * is on the path, switching branches instantly switches summaries too.
 */

export const add = internalMutation({
  args: {
    sceneId: v.id("scenes"),
    coveredFromSeq: v.number(),
    coveredThroughBeatId: v.id("beats"),
    text: v.string(),
  },
  returns: v.id("summaries"),
  handler: async (ctx, args) => {
    const beat = await ctx.db.get(args.coveredThroughBeatId);
    if (!beat || beat.sceneId !== args.sceneId) {
      throw new Error("coveredThroughBeatId must be a beat of this scene");
    }
    return await ctx.db.insert("summaries", {
      sceneId: args.sceneId,
      coveredFromSeq: args.coveredFromSeq,
      coveredThroughBeatId: args.coveredThroughBeatId,
      coveredThroughSeq: beat.seq,
      text: args.text,
      createdAt: nowMs(),
    });
  },
});

export const listForPath = query({
  args: { sceneId: v.id("scenes") },
  handler: async (ctx, { sceneId }) => {
    const scene = await requireScene(ctx, sceneId);
    await assertSceneAccess(ctx, scene);
    const projection = await projectPath(ctx, scene);
    return projection.summaries.sort((a, b) => b.coveredThroughSeq - a.coveredThroughSeq);
  },
});
