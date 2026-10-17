import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { assertSceneAccess, requireScene } from "./lib/authz";
import { estimateCostUsd } from "./lib/pricing";
import { nowMs } from "./lib/time";
import { generationModeV } from "./lib/validators";

/**
 * Usage ledger + per-scene rollup (PLAN §4.5, Phase 1.7).
 * The rollup is updated transactionally with each event so the meter reads
 * one row.
 */

type TierUsage = { tokensIn: number; tokensOut: number; costEstimateUsd: number };

export const record = internalMutation({
  args: {
    sceneId: v.id("scenes"),
    userId: v.optional(v.id("users")),
    tier: v.string(),
    provider: v.string(),
    modelId: v.string(),
    kind: generationModeV,
    tokensIn: v.number(),
    tokensOut: v.number(),
  },
  returns: v.object({ costEstimateUsd: v.number() }),
  handler: async (ctx, args) => {
    const model = `${args.provider}/${args.modelId}`;
    const costEstimateUsd = estimateCostUsd(model, args.tokensIn, args.tokensOut);

    await ctx.db.insert("usageEvents", {
      sceneId: args.sceneId,
      userId: args.userId,
      tier: args.tier,
      provider: args.provider,
      modelId: args.modelId,
      kind: args.kind,
      tokensIn: args.tokensIn,
      tokensOut: args.tokensOut,
      costEstimateUsd,
      createdAt: nowMs(),
    });

    const existing = await ctx.db
      .query("sceneUsage")
      .withIndex("by_scene", (q) => q.eq("sceneId", args.sceneId))
      .first();

    if (!existing) {
      await ctx.db.insert("sceneUsage", {
        sceneId: args.sceneId,
        tokensIn: args.tokensIn,
        tokensOut: args.tokensOut,
        costEstimateUsd,
        byTier: {
          [args.tier]: { tokensIn: args.tokensIn, tokensOut: args.tokensOut, costEstimateUsd },
        },
        updatedAt: nowMs(),
      });
    } else {
      const byTier = { ...(existing.byTier as Record<string, TierUsage>) };
      const current = byTier[args.tier] ?? { tokensIn: 0, tokensOut: 0, costEstimateUsd: 0 };
      byTier[args.tier] = {
        tokensIn: current.tokensIn + args.tokensIn,
        tokensOut: current.tokensOut + args.tokensOut,
        costEstimateUsd:
          Math.round((current.costEstimateUsd + costEstimateUsd) * 1e6) / 1e6,
      };
      await ctx.db.patch(existing._id, {
        tokensIn: existing.tokensIn + args.tokensIn,
        tokensOut: existing.tokensOut + args.tokensOut,
        costEstimateUsd: Math.round((existing.costEstimateUsd + costEstimateUsd) * 1e6) / 1e6,
        byTier,
        updatedAt: nowMs(),
      });
    }

    return { costEstimateUsd };
  },
});

export const getSceneUsage = query({
  args: { sceneId: v.id("scenes") },
  handler: async (ctx, { sceneId }) => {
    const scene = await requireScene(ctx, sceneId);
    await assertSceneAccess(ctx, scene);
    const row = await ctx.db
      .query("sceneUsage")
      .withIndex("by_scene", (q) => q.eq("sceneId", sceneId))
      .first();
    return (
      row ?? {
        sceneId,
        tokensIn: 0,
        tokensOut: 0,
        costEstimateUsd: 0,
        byTier: {},
        updatedAt: 0,
      }
    );
  },
});
