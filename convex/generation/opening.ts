import { action } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { compileRolePrompt } from "../compiler/compileRolePrompt";
import { outputReserveFor } from "../compiler/types";
import { getGateway } from "../lib/gatewayFactory";
import { ensurePromptMessages } from "../lib/gateway";
import { contextWindowFor } from "../lib/modelRegistry";
import { resolveModel } from "../lib/models";
import { relationsForRole, scenePromptData, type TurnContextView } from "./context";
import { recordEstimatedUsage } from "./record";

/**
 * Opening draft.
 *
 * The audition lets the director reroll the opening beat before canonizing it.
 * This action runs the same opening-turn prompt as `generation.turn.start`
 * (spotlight speaker, full provenance) but **writes no beat**: the audition
 * previews the text, and the chosen version is committed atomically through
 * `beats.appendOpening`. That keeps "nothing is destroyed" intact, no
 * abandoned opening beats pile up from rerolls, and lets the scene stay in
 * draft until the director presses Start.
 */
export const draft = action({
  args: { sceneId: v.id("scenes") },
  returns: v.object({
    text: v.string(),
    speakerRoleId: v.id("roles"),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ text: string; speakerRoleId: Id<"roles"> }> => {
    const view: TurnContextView = await ctx.runQuery(
      internal.generation.context.loadTurnContext,
      { sceneId: args.sceneId },
    );

    const candidates = view.roles.filter(
      (role) => role.kind === "ai" && role.status === "active",
    );
    if (candidates.length === 0) {
      throw new Error("Cast at least one active AI role before generating an opening");
    }
    const speaker =
      candidates.find((role) => role.tier === "spotlight") ?? candidates[0]!;

    const resolved = resolveModel(speaker.modelTier);
    const contextWindow = contextWindowFor(resolved.raw);
    const outputReserve = outputReserveFor(view.settings.lengthTarget);

    const compiled = compileRolePrompt({
      templates: view.templates,
      role: speaker.card,
      scene: scenePromptData(view.scene, view.settings),
      relations: relationsForRole(view, speaker),
      facts: view.facts,
      summaries: view.summaries,
      notes: view.notes,
      contextBeats: view.chain,
      mode: { kind: "turn" },
      model: {
        provider: resolved.provider,
        modelId: resolved.modelId,
        ref: resolved.raw,
        params:
          speaker.temperature !== undefined ? { temperature: speaker.temperature } : {},
      },
      contextWindow,
      outputReserve,
    });

    const gateway = getGateway();
    // A fresh scene has no beats, so the compiled message list is empty. The
    // provider rejects prompts without messages; the cue is the request.
    const messages = ensurePromptMessages(
      compiled.messages,
      `Begin the scene. Write ${speaker.name}'s opening beat.`,
    );
    let text = "";
    for await (const delta of gateway.stream({
      model: resolved.raw,
      system: compiled.system,
      messages,
      maxTokens: outputReserve,
    })) {
      text += delta;
    }
    text = text.trim();
    if (text.length === 0) {
      throw new Error("The opening came back empty. Try again.");
    }

    await ctx.runMutation(internal.generation.snapshots.write, {
      sceneId: args.sceneId,
      mode: "turn",
      roleId: speaker.id,
      blocks: compiled.snapshot.blocks,
      model: compiled.snapshot.model,
      tokenCounts: compiled.snapshot.tokenCounts,
      budget: compiled.snapshot.budget,
    });

    await recordEstimatedUsage(ctx, {
      sceneId: args.sceneId,
      kind: "turn",
      tier: speaker.modelTier,
      provider: resolved.provider,
      modelId: resolved.modelId,
      system: compiled.system,
      messages,
      output: text,
    });

    return { text, speakerRoleId: speaker.id };
  },
});
