import { action } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { SampleLinesSchema } from "../shared/contracts";
import { compileRolePrompt } from "../compiler/compileRolePrompt";
import { stableHash } from "../prompts/registry";
import { contextWindowFor } from "../lib/modelRegistry";
import { resolveModel } from "../lib/models";
import { getGateway } from "../lib/gatewayFactory";
import { ensurePromptMessages } from "../lib/gateway";
import { scenePromptData } from "./context";
import { recordEstimatedUsage } from "./record";

/**
 * Sample lines: hear a role's voice before playing. Cached per
 * revision hash so repeated auditions don't re-pay for the same
 * card; `force` regenerates deliberately.
 */
export const generate = action({
  args: { roleId: v.id("roles"), force: v.optional(v.boolean()) },
  returns: v.object({ lines: v.array(v.string()), cached: v.boolean() }),
  handler: async (ctx, args): Promise<{ lines: string[]; cached: boolean }> => {
    const loaded = await ctx.runQuery(internal.generation.context.loadRoleContext, {
      roleId: args.roleId,
    });
    const hash = stableHash(JSON.stringify(loaded.role.rawCard));

    if (args.force !== true) {
      const cached = await ctx.runQuery(internal.generation.helpers.getSampleCache, {
        roleId: args.roleId,
      });
      if (cached && cached.hash === hash && cached.lines.length >= 2) {
        return { lines: cached.lines, cached: true };
      }
    }

    const resolved = resolveModel("standard");
    const contextWindow = contextWindowFor(resolved.raw);
    const outputReserve = 300;

    const compiled = compileRolePrompt({
      templates: loaded.templates,
      role: loaded.role.card,
      scene: scenePromptData(loaded.scene, loaded.settings),
      relations: [],
      facts: [],
      summaries: [],
      notes: [],
      contextBeats: [],
      mode: { kind: "sampleLine" },
      model: { provider: resolved.provider, modelId: resolved.modelId, ref: resolved.raw },
      contextWindow,
      outputReserve,
    });

    const gateway = getGateway();
    // Sample lines draft before any beat exists; the message list needs a cue.
    const messages = ensurePromptMessages(compiled.messages, "Produce the sample lines now.");
    const out = await gateway.object({
      model: resolved.raw,
      system: compiled.system,
      messages,
      schema: SampleLinesSchema,
      schemaName: "sampleLine",
      maxTokens: outputReserve,
    });

    await ctx.runMutation(internal.generation.helpers.setSampleCache, {
      roleId: args.roleId,
      hash,
      lines: out.lines,
    });
    await ctx.runMutation(internal.generation.snapshots.write, {
      sceneId: loaded.scene.id,
      mode: "sampleLine",
      roleId: args.roleId,
      blocks: compiled.snapshot.blocks,
      model: compiled.snapshot.model,
      tokenCounts: compiled.snapshot.tokenCounts,
      budget: compiled.snapshot.budget,
    });
    await recordEstimatedUsage(ctx, {
      sceneId: loaded.scene.id,
      kind: "sampleLine",
      tier: "standard",
      provider: resolved.provider,
      modelId: resolved.modelId,
      system: compiled.system,
      messages,
      output: JSON.stringify(out),
    });

    return { lines: out.lines, cached: false };
  },
});
