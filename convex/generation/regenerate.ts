import { action, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { components, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { Agent } from "@convex-dev/agent";
import type { LanguageModelV4 } from "@ai-sdk/provider";
import type { ToolSet } from "ai";
import { createRegenerateFork } from "../beats";
import { compileRolePrompt } from "../compiler/compileRolePrompt";
import { outputReserveFor } from "../compiler/types";
import { currentUserId } from "../lib/authz";
import { contextWindowFor, resolveLanguageModel } from "../lib/modelRegistry";
import { resolveModel } from "../lib/models";
import type { TurnContextView } from "./context";
import { relationsForRole, scenePromptData } from "./context";

/**
 * Regenerate a beat.
 *
 * Law fork-on-edit: never edit in place. The action forks a new branch from the target's
 * parent, streams the same role's voice into a new beat with the current path
 * context (+ optional director instruction), and leaves the original branch
 * untouched. If generation fails, the active pointers are restored so a failed
 * attempt never becomes canon.
 */

export const beginFork = internalMutation({
  args: { beatId: v.id("beats"), userId: v.id("users") },
  returns: v.object({ newBeatId: v.id("beats"), branchId: v.id("branches") }),
  handler: async (ctx, args) => {
    const beat = await ctx.db.get(args.beatId);
    if (!beat) throw new Error("Beat not found");
    const scene = await ctx.db.get(beat.sceneId);
    if (!scene) throw new Error("Scene not found");
    return await createRegenerateFork(ctx, {
      beat,
      scene,
      userId: args.userId,
    });
  },
});

export const restorePointers = internalMutation({
  args: {
    sceneId: v.id("scenes"),
    branchId: v.optional(v.id("branches")),
    tipBeatId: v.optional(v.id("beats")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sceneId, {
      activeBranchId: args.branchId,
      activeTipBeatId: args.tipBeatId,
    });
  },
});

const readNumber = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

export const beat = action({
  args: {
    beatId: v.id("beats"),
    /** Applied to the prompt only for this attempt (regenerate-from-note). */
    instruction: v.optional(v.string()),
  },
  returns: v.object({
    status: v.union(v.literal("done"), v.literal("skipped"), v.literal("failed")),
    beatId: v.optional(v.id("beats")),
    branchId: v.optional(v.id("branches")),
    speakerRoleId: v.optional(v.id("roles")),
    error: v.optional(v.string()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    status: "done" | "skipped" | "failed";
    beatId?: Id<"beats">;
    branchId?: Id<"branches">;
    speakerRoleId?: Id<"roles">;
    error?: string;
  }> => {
    const target = await ctx.runQuery(
      internal.generation.context.loadBeatForRegen,
      { beatId: args.beatId },
    );
    const view: TurnContextView = await ctx.runQuery(
      internal.generation.context.loadOptionsContext,
      { sceneId: target.sceneId, tipBeatId: target.beat._id },
    );

    if (view.scene.status === "archived") {
      return { status: "skipped", error: "This scene is archived" };
    }

    const requested = target.beat.speakerRoleId;
    const speaker = requested
      ? view.roles.find((role) => role.id === requested)
      : (view.roles.find(
          (role) =>
            role.kind === "ai" &&
            role.status === "active" &&
            role.tier === "spotlight",
        ) ??
        view.roles.find((role) => role.kind === "ai" && role.status === "active"));
    if (!speaker) {
      return { status: "skipped", error: "No active AI role to regenerate" };
    }
    if (speaker.kind !== "ai" || speaker.status !== "active") {
      return {
        status: "skipped",
        error: "Only beats spoken by an active AI role can be regenerated",
      };
    }

    const running = await ctx.runQuery(
      internal.generation.runs.statusForScene,
      { sceneId: target.sceneId },
    );
    if (running) {
      return {
        status: "skipped",
        error: "A generation is already running for this scene",
      };
    }

    const userId = await currentUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

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
          speaker.temperature !== undefined
            ? { temperature: speaker.temperature }
            : {},
      },
      contextWindow,
      outputReserve,
    });

    const instruction = args.instruction?.trim();
    const messages = instruction
      ? [
          ...compiled.messages,
          {
            role: "user" as const,
            content: `Rewrite the last beat with this direction: ${instruction}`,
          },
        ]
      : compiled.messages;

    const previousBranchId = view.scene.activeBranchId;
    const previousTipBeatId = view.scene.activeTipBeatId;

    const runId = await ctx.runMutation(internal.generation.runs.begin, {
      sceneId: target.sceneId,
      branchId: target.beat.branchId,
      parentBeatId: target.beat.parentBeatId,
      mode: "turn",
      roleId: speaker.id,
    });
    if (!runId) throw new Error("Could not begin the regeneration run");

    let fork: { newBeatId: Id<"beats">; branchId: Id<"branches"> };
    try {
      fork = await ctx.runMutation(internal.generation.regenerate.beginFork, {
        beatId: args.beatId,
        userId,
      });
    } catch (error) {
      await ctx.runMutation(internal.generation.runs.fail, {
        runId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
    await ctx.runMutation(internal.generation.lifecycle.bindRun, {
      beatId: fork.newBeatId,
      runId,
    });

    const AgentCtor = Agent as unknown as new (
      component: typeof components.agent,
      options: {
        name: string;
        languageModel: LanguageModelV4;
        instructions: string;
      },
    ) => Agent<object, ToolSet>;
    const agent = new AgentCtor(components.agent, {
      name: speaker.name,
      languageModel: resolveLanguageModel(resolved.raw) as LanguageModelV4,
      instructions: compiled.system,
    });
    let threadId = view.scene.threadId;
    if (!threadId) {
      const created = await agent.createThread(ctx, { title: view.scene.title });
      threadId = created.threadId;
      await ctx.runMutation(internal.generation.context.setSceneThread, {
        sceneId: target.sceneId,
        threadId,
      });
    }

    let text = "";
    let outcome: "done" | "failed" | "aborted" = "done";
    let failure: string | undefined;
    let streamMessageId: string | undefined;
    let tokensIn = 0;
    let tokensOut = 0;

    const abortController = new AbortController();
    const abortPoll = setInterval(() => {
      void ctx
        .runQuery(internal.generation.runs.isAborted, { runId })
        .then((aborted) => {
          if (aborted) abortController.abort();
        })
        .catch(() => undefined);
    }, 400);

    try {
      const result = await agent.streamText(
        ctx,
        { threadId },
        {
          system: compiled.system,
          messages,
          maxOutputTokens: outputReserve,
          abortSignal: abortController.signal,
        },
        { saveStreamDeltas: { returnImmediately: true } },
      );

      let chunkCount = 0;
      for await (const delta of result.textStream) {
        text += delta;
        chunkCount += 1;
        if (chunkCount % 5 === 0) {
          const aborted = await ctx.runQuery(
            internal.generation.runs.isAborted,
            { runId },
          );
          if (aborted) {
            outcome = "aborted";
            abortController.abort();
            break;
          }
        }
      }

      if (outcome === "done") {
        const finishReason = await result.finishReason;
        if (String(finishReason) === "error") {
          outcome = "failed";
          failure = "Model stream finished with an error";
        }
      }

      try {
        const usage = await result.usage;
        tokensIn = readNumber((usage as { inputTokens?: unknown }).inputTokens);
        tokensOut = readNumber((usage as { outputTokens?: unknown }).outputTokens);
      } catch {
        // Usage unavailable on aborted streams.
      }

      const saved = result.savedMessages;
      const outputMessage = saved && saved.length > 0 ? saved[saved.length - 1] : undefined;
      if (outputMessage?._id) streamMessageId = outputMessage._id as string;
    } catch (error) {
      const aborted = await ctx
        .runQuery(internal.generation.runs.isAborted, { runId })
        .catch(() => false);
      outcome = aborted ? "aborted" : "failed";
      failure = aborted ? undefined : error instanceof Error ? error.message : String(error);
    } finally {
      clearInterval(abortPoll);
    }

    await ctx.runMutation(internal.generation.lifecycle.completeRun, {
      sceneId: target.sceneId,
      runId,
      beatId: fork.newBeatId,
      text: text.trim(),
      outcome,
      keepPartial: view.settings.turnRules.abortedKeepsPartial,
      opening: false,
      model: resolved.raw,
      streamMessageId,
      tier: speaker.modelTier,
      provider: resolved.provider,
      modelId: resolved.modelId,
      tokensIn,
      tokensOut,
      snapshot: {
        mode: "turn",
        blocks: compiled.snapshot.blocks,
        model: compiled.snapshot.model,
        tokenCounts: compiled.snapshot.tokenCounts,
        budget: compiled.snapshot.budget,
      },
      roleId: speaker.id,
    });

    const keepAborted =
      outcome === "aborted" && view.settings.turnRules.abortedKeepsPartial;
    if (outcome === "failed" || (outcome === "aborted" && !keepAborted)) {
      await ctx.runMutation(internal.generation.regenerate.restorePointers, {
        sceneId: target.sceneId,
        branchId: previousBranchId,
        tipBeatId: previousTipBeatId,
      });
    }

    if (outcome !== "done") {
      return {
        status: outcome === "aborted" ? "skipped" : "failed",
        beatId: fork.newBeatId,
        branchId: fork.branchId,
        speakerRoleId: speaker.id,
        error:
          outcome === "aborted"
            ? "Regeneration stopped"
            : (failure ?? "Regeneration failed"),
      };
    }

    return {
      status: "done",
      beatId: fork.newBeatId,
      branchId: fork.branchId,
      speakerRoleId: speaker.id,
    };
  },
});
