import { action } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  PathOptionsSchema,
  STATE_CHANGING_STRATEGIES,
  type PathOption,
} from "../shared/contracts";
import { finalizeSingleBlock, renderBeatLine } from "../compiler/blocks";
import { contextWindowFor } from "../lib/modelRegistry";
import { resolveModel } from "../lib/models";
import { getGateway } from "../lib/gatewayFactory";
import { recordEstimatedUsage } from "./record";
import type { RoleView } from "./context";

/**
 * Path options (PLAN §7.3, §8.3): generateObject with validation → one
 * repair pass → deterministic fallback. Candidates + snapshot persist
 * atomically; option cards render inline under the beat they attach to.
 *
 * Public action: the director's-chair "Offer paths" button AND the automatic
 * cadence (called by the turn action) use this same entry point.
 */

function optionProblems(options: PathOption[], activeIds: Set<string>): string[] {
  const problems: string[] = [];
  for (const option of options) {
    if (!activeIds.has(option.speakerRoleId)) {
      problems.push(`speakerRoleId "${option.speakerRoleId}" is not an active role`);
    }
  }
  const strategies = new Set(options.map((option) => option.strategy));
  if (strategies.size < 2) {
    problems.push("options must be strategically divergent (≥2 distinct strategies)");
  }
  const stateChanging = STATE_CHANGING_STRATEGIES as readonly string[];
  if (!options.some((option) => stateChanging.includes(option.strategy))) {
    problems.push("at least one option must change scene state");
  }
  return problems;
}

const FALLBACK_LABELS = ["Force the moment", "Hold the line", "Change the subject"];
const FALLBACK_STRATEGIES = ["escalate", "deflect", "commit"] as const;

function fallbackOptions(count: number, roles: RoleView[]): PathOption[] {
  const size = Math.min(4, Math.max(2, count));
  return Array.from({ length: size }, (_, index) => {
    const role = roles[index % roles.length];
    const label = FALLBACK_LABELS[index % FALLBACK_LABELS.length] ?? "Hold the line";
    const strategy = FALLBACK_STRATEGIES[index % FALLBACK_STRATEGIES.length] ?? "deflect";
    return {
      label,
      speakerRoleId: role ? (role.id as string) : "missing",
      text: role
        ? `${role.name} takes the beat in hand and moves the scene forward.`
        : "The scene moves forward.",
      strategy,
    };
  });
}

export const offer = action({
  args: { sceneId: v.id("scenes"), parentBeatId: v.id("beats") },
  returns: v.object({
    candidateIds: v.array(v.id("candidates")),
    warnings: v.array(v.string()),
    fallback: v.boolean(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ candidateIds: Id<"candidates">[]; warnings: string[]; fallback: boolean }> => {
    const view = await ctx.runQuery(internal.generation.context.loadOptionsContext, {
      sceneId: args.sceneId,
      tipBeatId: args.parentBeatId,
    });
    const activeRoles = view.roles.filter((role) => role.status === "active");
    if (activeRoles.length === 0) throw new Error("No active roles to offer paths for");
    const activeIds = new Set(activeRoles.map((role) => role.id as string));

    const count = Math.min(4, Math.max(2, view.settings.optionsDefaultCount));
    const resolved = resolveModel("spotlight");
    const contextWindow = contextWindowFor(resolved.raw);
    const outputReserve = 600;

    const compiled = finalizeSingleBlock({
      templates: view.templates,
      templateKey: "mode.options",
      vars: {
        count,
        presentationStyle: view.settings.presentationStyle,
        lengthTarget: view.settings.lengthTarget,
        roleIds: activeRoles.map((role) => role.id).join(", "),
      },
      messages: [
        {
          role: "user",
          content: `Recent beats:\n${view.chain.slice(-6).map(renderBeatLine).join("\n") || "(none yet)"}`,
        },
      ],
      mode: "options",
      model: { provider: resolved.provider, modelId: resolved.modelId, ref: resolved.raw },
      contextWindow,
      outputReserve,
    });

    const gateway = getGateway();
    const ask = async (extra?: string) => {
      const messages = extra
        ? [...compiled.messages, { role: "user" as const, content: extra }]
        : compiled.messages;
      return await gateway.object({
        model: resolved.raw,
        system: compiled.system,
        messages,
        schema: PathOptionsSchema,
        schemaName: "options",
        maxTokens: outputReserve,
      });
    };

    const warnings: string[] = [];
    let options: PathOption[] | null = null;
    try {
      options = (await ask()).options;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      try {
        options = (
          await ask(
            `Your previous response failed validation (${message}). Return 2–4 valid options now.`,
          )
        ).options;
      } catch {
        options = null;
        warnings.push(
          "Model options failed validation twice — deterministic fallback used",
        );
      }
    }

    if (options) {
      const problems = optionProblems(options, activeIds);
      if (problems.length > 0) {
        warnings.push(...problems);
        try {
          const repaired = await ask(
            `Fix these problems and return valid options: ${problems.join("; ")}`,
          );
          options = repaired.options;
        } catch {
          // Keep the previous attempt for one more validity check.
        }
        const remaining = optionProblems(options, activeIds);
        if (remaining.length > 0) options = null;
      }
    }

    let fallback = false;
    if (!options) {
      options = fallbackOptions(count, activeRoles);
      fallback = true;
    }

    const candidateIds = await ctx.runMutation(
      internal.candidates.createBatchWithSnapshot,
      {
        sceneId: args.sceneId,
        parentBeatId: args.parentBeatId,
        snapshot: {
          mode: "options",
          blocks: compiled.snapshot.blocks,
          model: compiled.snapshot.model,
          tokenCounts: compiled.snapshot.tokenCounts,
          budget: compiled.snapshot.budget,
        },
        options: options.map((option) => ({
          label: option.label,
          speakerRoleId: activeIds.has(option.speakerRoleId)
            ? (option.speakerRoleId as Id<"roles">)
            : undefined,
          text: option.text,
          strategy: option.strategy,
        })),
      },
    );

    await recordEstimatedUsage(ctx, {
      sceneId: args.sceneId,
      kind: "options",
      tier: "spotlight",
      provider: resolved.provider,
      modelId: resolved.modelId,
      system: compiled.system,
      messages: compiled.messages,
      output: JSON.stringify(options),
    });

    return { candidateIds, warnings, fallback };
  },
});
