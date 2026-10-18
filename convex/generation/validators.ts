import { v } from "convex/values";
import { generationModeV } from "../lib/validators";

/** Shared validator for compiled prompt snapshots. */
export const snapshotV = v.object({
  mode: generationModeV,
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
  model: v.object({ provider: v.string(), modelId: v.string(), params: v.any() }),
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
});
