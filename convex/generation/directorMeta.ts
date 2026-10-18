import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { DirectorMetaSchema } from "../shared/contracts";
import { compileDirectorPrompt } from "../compiler/compileDirectorMeta";
import { renderBeatLine, renderRoleLine } from "../compiler/blocks";
import { contextWindowFor } from "../lib/modelRegistry";
import { resolveModel } from "../lib/models";
import { getGateway } from "../lib/gatewayFactory";
import { recordEstimatedUsage } from "./record";

/**
 * Director meta-agent: decision points, responder
 * ordering, pacing, ending detection. Never writes in-fiction content and
 * never fails the caller, on any error it returns { meta: null } and the
 * caller falls back to deterministic floor resolution.
 */
export const decide = internalAction({
  args: { sceneId: v.id("scenes") },
  returns: v.object({ meta: v.any() }),
  handler: async (ctx, { sceneId }): Promise<{ meta: unknown }> => {
    try {
      const view = await ctx.runQuery(internal.generation.context.loadTurnContext, { sceneId });
      const resolved = resolveModel("cheap");
      const contextWindow = contextWindowFor(resolved.raw);
      const outputReserve = 400;

      const rolesLines = view.roles
        .filter((role) => role.status === "active")
        .map((role) =>
          renderRoleLine({
            id: role.id,
            name: role.name,
            tier: role.tier,
            storyRole: role.storyRole,
          }),
        )
        .join("\n");
      const tensionsLine = Object.entries(view.tensions)
        .map(([roleId, tension]) => `${roleId}: ${tension.toFixed(2)}`)
        .join("; ");

      const compiled = compileDirectorPrompt({
        templates: view.templates,
        model: { provider: resolved.provider, modelId: resolved.modelId, ref: resolved.raw },
        // Recent beats (latest last), ending detection needs the run-up, not
        // just the final line.
        lastBeat: view.chain
          .slice(-3)
          .map(renderBeatLine)
          .join("\n"),
        rolesLines,
        tensionsLine,
        turnMode: view.settings.turnRules.mode,
        branchFrequency: view.settings.branchFrequency,
        contextWindow,
        outputReserve,
      });

      const gateway = getGateway();
      const meta = await gateway.object({
        model: resolved.raw,
        system: compiled.system,
        messages: compiled.messages,
        schema: DirectorMetaSchema,
        schemaName: "directorMeta",
        maxTokens: outputReserve,
      });

      const activeIds = new Set(
        view.roles.filter((role) => role.status === "active").map((role) => role.id as string),
      );
      const normalized = {
        ...meta,
        responders: meta.responders.filter((id) => activeIds.has(id)),
      };

      await ctx.runMutation(internal.generation.snapshots.write, {
        sceneId,
        mode: "directorMeta",
        blocks: compiled.snapshot.blocks,
        model: compiled.snapshot.model,
        tokenCounts: compiled.snapshot.tokenCounts,
        budget: compiled.snapshot.budget,
      });
      await recordEstimatedUsage(ctx, {
        sceneId,
        kind: "directorMeta",
        tier: "cheap",
        provider: resolved.provider,
        modelId: resolved.modelId,
        system: compiled.system,
        messages: compiled.messages,
        output: JSON.stringify(normalized),
      });

      return { meta: normalized };
    } catch {
      return { meta: null };
    }
  },
});
