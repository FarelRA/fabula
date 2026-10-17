import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { nowMs } from "../lib/time";
import { generationModeV } from "../lib/validators";

/**
 * Prompt provenance (PLAN §7.5): every generation writes a snapshot with its
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
