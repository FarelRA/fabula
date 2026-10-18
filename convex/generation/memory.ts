import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { ContinuitySchema, FactsSchema, SummarySchema } from "../shared/contracts";
import { compileContinuityPrompt, compileFactsPrompt, compileSummaryPrompt } from "../compiler/compileMemory";
import { contextWindowFor } from "../lib/modelRegistry";
import { resolveModel } from "../lib/models";
import { getGateway } from "../lib/gatewayFactory";
import { isDuplicateFact } from "../domain/factDedupe";
import { recordEstimatedUsage } from "./record";

/**
 * Memory agent: rolling summaries every N beats, fact
 * extraction with dedupe, continuity warnings. Runs non-fatally after beats;
 * each product writes its own prompt snapshot and usage event.
 */

export const runPass = internalAction({
  args: { sceneId: v.id("scenes"), force: v.optional(v.boolean()) },
  returns: v.object({
    ran: v.boolean(),
    summary: v.optional(v.string()),
    factsAdded: v.number(),
    warningsAdded: v.number(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    ran: boolean;
    summary?: string;
    factsAdded: number;
    warningsAdded: number;
  }> => {
    const view = await ctx.runQuery(internal.generation.context.loadTurnContext, {
      sceneId: args.sceneId,
      // Internal pass: wrap-summary scheduling has no identity, and callers
      // of this action already gated access (turn action / endScene).
      trusted: true,
    });

    const lastSummarySeq = view.summaries.reduce(
      (max, summary) => Math.max(max, summary.coveredThroughSeq),
      0,
    );
    const window = view.chain.filter((beat) => beat.seq > lastSummarySeq);
    if (!args.force && window.length < view.settings.summaryEveryN) {
      return { ran: false, factsAdded: 0, warningsAdded: 0 };
    }
    const firstWindowBeat = window[0];
    const lastWindowBeat = window[window.length - 1];
    if (!firstWindowBeat || !lastWindowBeat) {
      return { ran: false, factsAdded: 0, warningsAdded: 0 };
    }

    const resolved = resolveModel("cheap");
    const contextWindow = contextWindowFor(resolved.raw);
    const outputReserve = 500;
    const modelRef = { provider: resolved.provider, modelId: resolved.modelId, ref: resolved.raw };
    const gateway = getGateway();
    const roleIds = new Set(view.roles.map((role) => role.id as string));

    let summaryText: string | undefined;
    let factsAdded = 0;
    let warningsAdded = 0;

    // (1) rolling summary
    try {
      const compiled = compileSummaryPrompt({
        templates: view.templates,
        model: modelRef,
        window,
        fromSeq: firstWindowBeat.seq,
        throughSeq: lastWindowBeat.seq,
        contextWindow,
        outputReserve,
      });
      const out = await gateway.object({
        model: resolved.raw,
        system: compiled.system,
        messages: compiled.messages,
        schema: SummarySchema,
        schemaName: "summary",
        maxTokens: outputReserve,
      });
      await ctx.runMutation(internal.summaries.add, {
        sceneId: args.sceneId,
        coveredFromSeq: Math.max(
          firstWindowBeat.seq,
          Math.min(out.coveredFromSeq, lastWindowBeat.seq),
        ),
        coveredThroughBeatId: lastWindowBeat.id as Id<"beats">,
        text: out.summary,
      });
      summaryText = out.summary;
      await ctx.runMutation(internal.generation.snapshots.write, {
        sceneId: args.sceneId,
        mode: "summary",
        beatId: lastWindowBeat.id as Id<"beats">,
        blocks: compiled.snapshot.blocks,
        model: compiled.snapshot.model,
        tokenCounts: compiled.snapshot.tokenCounts,
        budget: compiled.snapshot.budget,
      });
      await recordEstimatedUsage(ctx, {
        sceneId: args.sceneId,
        kind: "summary",
        tier: "cheap",
        provider: resolved.provider,
        modelId: resolved.modelId,
        system: compiled.system,
        messages: compiled.messages,
        output: JSON.stringify(out),
      });
    } catch {
      // Non-fatal: the beat stream stays intact.
    }

    // (2) fact extraction with dedupe
    try {
      const existingTexts = view.facts.map((fact) => fact.text);
      const compiled = compileFactsPrompt({
        templates: view.templates,
        model: modelRef,
        window,
        fromSeq: firstWindowBeat.seq,
        existingFacts: existingTexts,
        max: 5,
        contextWindow,
        outputReserve,
      });
      const out = await gateway.object({
        model: resolved.raw,
        system: compiled.system,
        messages: compiled.messages,
        schema: FactsSchema,
        schemaName: "facts",
        maxTokens: outputReserve,
      });
      const windowIds = new Set(window.map((beat) => beat.id));
      const seen = [...existingTexts];
      const insertable: Array<{
        text: string;
        subjects: Id<"roles">[];
        visibilityKind: "public" | "private";
        visibilityRoleIds: Id<"roles">[];
        nodeId: Id<"beats">;
      }> = [];
      for (const fact of out.facts) {
        if (isDuplicateFact(fact.text, seen)) continue;
        seen.push(fact.text);
        const subjects = fact.subjects.filter((id) => roleIds.has(id)) as Id<"roles">[];
        insertable.push({
          text: fact.text,
          subjects,
          visibilityKind: fact.visibility,
          visibilityRoleIds: fact.visibility === "private" ? subjects : [],
          nodeId: (windowIds.has(fact.nodeId) ? fact.nodeId : lastWindowBeat.id) as Id<"beats">,
        });
      }
      if (insertable.length > 0) {
        await ctx.runMutation(internal.facts.insertExtracted, {
          sceneId: args.sceneId,
          facts: insertable,
        });
      }
      factsAdded = insertable.length;
      await ctx.runMutation(internal.generation.snapshots.write, {
        sceneId: args.sceneId,
        mode: "facts",
        beatId: lastWindowBeat.id as Id<"beats">,
        blocks: compiled.snapshot.blocks,
        model: compiled.snapshot.model,
        tokenCounts: compiled.snapshot.tokenCounts,
        budget: compiled.snapshot.budget,
      });
      await recordEstimatedUsage(ctx, {
        sceneId: args.sceneId,
        kind: "facts",
        tier: "cheap",
        provider: resolved.provider,
        modelId: resolved.modelId,
        system: compiled.system,
        messages: compiled.messages,
        output: JSON.stringify(out),
      });
    } catch {
      // Non-fatal.
    }

    // (3) continuity warnings
    try {
      const compiled = compileContinuityPrompt({
        templates: view.templates,
        model: modelRef,
        recentBeats: window,
        facts: view.facts.map((fact) => fact.text),
        contextWindow,
        outputReserve,
      });
      const out = await gateway.object({
        model: resolved.raw,
        system: compiled.system,
        messages: compiled.messages,
        schema: ContinuitySchema,
        schemaName: "continuity",
        maxTokens: outputReserve,
      });
      if (out.warnings.length > 0) {
        await ctx.runMutation(internal.generation.helpers.insertWarnings, {
          sceneId: args.sceneId,
          beatId: lastWindowBeat.id as Id<"beats">,
          warnings: out.warnings,
        });
        warningsAdded = out.warnings.length;
      }
      await ctx.runMutation(internal.generation.snapshots.write, {
        sceneId: args.sceneId,
        mode: "continuity",
        beatId: lastWindowBeat.id as Id<"beats">,
        blocks: compiled.snapshot.blocks,
        model: compiled.snapshot.model,
        tokenCounts: compiled.snapshot.tokenCounts,
        budget: compiled.snapshot.budget,
      });
      await recordEstimatedUsage(ctx, {
        sceneId: args.sceneId,
        kind: "continuity",
        tier: "cheap",
        provider: resolved.provider,
        modelId: resolved.modelId,
        system: compiled.system,
        messages: compiled.messages,
        output: JSON.stringify(out),
      });
    } catch {
      // Non-fatal.
    }

    return { ran: true, summary: summaryText, factsAdded, warningsAdded };
  },
});
