import { action } from "../_generated/server";
import { v } from "convex/values";
import type { ToolSet } from "ai";
import { internal, components, api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { Agent } from "@convex-dev/agent";
import type { LanguageModelV4 } from "@ai-sdk/provider";
import type { DirectorMeta } from "../shared/contracts";
import { compileRolePrompt } from "../compiler/compileRolePrompt";
import { outputReserveFor } from "../compiler/types";
import { contextWindowFor, resolveLanguageModel } from "../lib/modelRegistry";
import { resolveModel } from "../lib/models";
import { resolveFloor, detectStall } from "../domain/orchestrate";
import {
  relationsForRole,
  scenePromptData,
  type RoleView,
  type TurnContextView,
} from "./context";

/**
 * Turn generation: resolve the floor → compile the role
 * prompt → stream through the agent component (deltas persisted via
 * saveStreamDeltas, so streams survive reloads) → finalize the beat, write
 * the snapshot, record usage, then run director/memory follow-ups.
 *
 * Failure isolation: a failure before the first delta leaves NO beat row; a
 * mid-stream failure marks the beat failed; aborted-and-discarded output
 * becomes an artifact that never moves the active tip.
 */

const readNumber = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

export const start = action({
  args: {
    sceneId: v.id("scenes"),
    speakerRoleId: v.optional(v.id("roles")),
    parentBeatId: v.optional(v.id("beats")),
    opening: v.optional(v.boolean()),
  },
  returns: v.object({
    status: v.union(v.literal("done"), v.literal("skipped"), v.literal("failed")),
    runId: v.optional(v.id("generationRuns")),
    beatId: v.optional(v.id("beats")),
    speakerRoleId: v.optional(v.id("roles")),
    decisionPoint: v.boolean(),
    skippedReason: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    status: "done" | "skipped" | "failed";
    runId?: Id<"generationRuns">;
    beatId?: Id<"beats">;
    speakerRoleId?: Id<"roles">;
    decisionPoint: boolean;
    skippedReason?: string;
    error?: string;
  }> => {
    const view: TurnContextView = await ctx.runQuery(
      internal.generation.context.loadTurnContext,
      { sceneId: args.sceneId },
    );
    const opening = args.opening === true;

    if (view.scene.status === "archived") {
      throw new Error("This scene is archived. The story is frozen, but undoing the wrap reopens it.");
    }

    if (opening) {
      if (view.scene.activeTipBeatId !== undefined) {
        throw new Error("Opening already exists for this scene");
      }
    } else if (view.scene.activeTipBeatId === undefined) {
      return {
        status: "skipped",
        decisionPoint: false,
        skippedReason: "The scene has no opening beat yet",
      };
    }

    const activeRoles = view.roles.filter(
      (role) => role.status === "active" && role.kind === "ai",
    );
    if (activeRoles.length === 0) {
      return { status: "skipped", decisionPoint: false, skippedReason: "No active AI roles" };
    }

    const mode = view.settings.turnRules.mode;
    let speaker: RoleView | undefined = args.speakerRoleId
      ? view.roles.find((role) => role.id === args.speakerRoleId)
      : undefined;
    if (speaker && (speaker.status !== "active" || speaker.kind !== "ai")) {
      throw new Error("Requested speaker is not an active AI role");
    }

    if (!speaker && !opening && (mode === "directorLed" || mode === "freeform")) {
      return {
        status: "skipped",
        decisionPoint: false,
        skippedReason:
          mode === "directorLed"
            ? "Director-led: awaiting the queue"
            : "Freeform: awaiting an explicit cue",
      };
    }

    let meta: DirectorMeta | null = null;
    if (!opening && !args.speakerRoleId) {
      const metaResult = await ctx
        .runAction(internal.generation.directorMeta.decide, { sceneId: args.sceneId })
        .catch(() => ({ meta: null as unknown }));
      meta = (metaResult.meta ?? null) as DirectorMeta | null;
      if (meta) {
        // End detection: the streak only *surfaces* a
        // wrap offer in the UI, the scene never auto-archives.
        await ctx.runMutation(internal.scenes.recordEndingSignal, {
          sceneId: args.sceneId,
          suggested: meta.endingSuggested,
        });
      }
      if (mode === "reactive" && meta) {
        const responderId = meta.responders.find((id) =>
          activeRoles.some((role) => role.id === id),
        );
        if (responderId) {
          speaker = activeRoles.find((role) => role.id === responderId);
        }
      }
    }

    if (!speaker) {
      if (opening) {
        const opener =
          activeRoles.find((role) => role.tier === "spotlight") ?? activeRoles[0];
        speaker = opener;
      } else {
        const floor = resolveFloor({
          mode,
          roles: view.roles.map((role) => ({
            id: role.id,
            name: role.name,
            tier: role.tier,
            status: role.status,
          })),
          lastBeat: view.lastBeat
            ? {
                text: view.lastBeat.text,
                speakerRoleId: view.lastBeat.speakerRoleId,
              }
            : undefined,
          tensions: view.tensions,
          cooldown: view.cooldown,
          factSubjects: view.factSubjectsWindow,
        });
        if (floor.skip || !floor.speakerRoleId) {
          return {
            status: "skipped",
            decisionPoint: meta?.decisionPoint ?? false,
            skippedReason: floor.reason,
          };
        }
        speaker = activeRoles.find((role) => role.id === floor.speakerRoleId);
        if (!speaker) {
          return {
            status: "skipped",
            decisionPoint: meta?.decisionPoint ?? false,
            skippedReason: "Resolved speaker is not an active AI role",
          };
        }
      }
    }

    if (!speaker) {
      return {
        status: "skipped",
        decisionPoint: meta?.decisionPoint ?? false,
        skippedReason: "No eligible speaker for this turn",
      };
    }

    const parentBeatId = opening
      ? undefined
      : (args.parentBeatId ?? view.scene.activeTipBeatId);
    const branchId = view.scene.activeBranchId;
    if (!branchId) throw new Error("Scene has no branch");

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
        params: speaker.temperature !== undefined ? { temperature: speaker.temperature } : {},
      },
      contextWindow,
      outputReserve,
    });

    const runId = await ctx.runMutation(internal.generation.runs.begin, {
      sceneId: args.sceneId,
      branchId,
      parentBeatId,
      mode: "turn",
      roleId: speaker.id,
    });

    // TS2590 guard: instantiating Agent through the raw constructor blows up
    // TS's union complexity against our generated component api. The runtime
    // shape is identical; we pin the call signature locally.
    const AgentCtor = Agent as unknown as new (
      component: typeof components.agent,
      options: { name: string; languageModel: LanguageModelV4; instructions: string },
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
        sceneId: args.sceneId,
        threadId,
      });
    }

    let beatId: Id<"beats"> | undefined;
    let streamMessageId: string | undefined;
    let text = "";
    let outcome: "done" | "failed" | "aborted" = "done";
    let failure: string | undefined;
    let tokensIn = 0;
    let tokensOut = 0;

    // Abort plumbing: the director's abort flag trips this signal
    // so the provider stream stops server-side, not just in the reader.
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
          messages: compiled.messages,
          maxOutputTokens: outputReserve,
          abortSignal: abortController.signal,
        },
        { saveStreamDeltas: { returnImmediately: true } },
      );

      let chunkCount = 0;
      for await (const delta of result.textStream) {
        text += delta;
        chunkCount += 1;
        if (!beatId) {
          const begun = await ctx.runMutation(internal.generation.lifecycle.beginBeat, {
            sceneId: args.sceneId,
            runId,
            roleId: speaker.id,
            parentBeatId,
            opening,
          });
          beatId = begun.beatId;
        } else if (chunkCount % 5 === 0) {
          const aborted = await ctx.runQuery(internal.generation.runs.isAborted, { runId });
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
        // Usage unavailable (aborted stream), record zeros.
      }

      const saved = result.savedMessages;
      const outputMessage = saved && saved.length > 0 ? saved[saved.length - 1] : undefined;
      if (outputMessage?._id) {
        streamMessageId = outputMessage._id as string;
      }
    } catch (error) {
      // An aborted provider stream surfaces as a thrown error; the abort flag
      // is the source of truth for which outcome to record.
      const aborted = await ctx
        .runQuery(internal.generation.runs.isAborted, { runId })
        .catch(() => false);
      outcome = aborted ? "aborted" : "failed";
      failure = aborted ? undefined : error instanceof Error ? error.message : String(error);
    } finally {
      clearInterval(abortPoll);
    }

    await ctx.runMutation(internal.generation.lifecycle.completeRun, {
      sceneId: args.sceneId,
      runId,
      beatId,
      text: text.trim(),
      outcome,
      keepPartial: view.settings.turnRules.abortedKeepsPartial,
      opening,
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

    if (outcome === "done" && beatId) {
      const cadence = view.settings.branchFrequency;
      const stalled = detectStall({ beatsSinceStateChange: view.beatsSinceStateChange });
      const wantOptions =
        cadence === "always" || (cadence === "key" && ((meta?.decisionPoint ?? false) || stalled));
      if (wantOptions) {
        await ctx
          .runAction(api.generation.options.offer, {
            sceneId: args.sceneId,
            parentBeatId: beatId,
          })
          .catch(() => undefined);
      }
      await ctx
        .runAction(internal.generation.memory.runPass, { sceneId: args.sceneId })
        .catch(() => undefined);
    } else if (outcome === "aborted" && view.settings.turnRules.abortedKeepsPartial) {
      await ctx
        .runAction(internal.generation.memory.runPass, { sceneId: args.sceneId })
        .catch(() => undefined);
    }

    if (outcome === "failed") {
      return {
        status: "failed",
        runId,
        beatId,
        speakerRoleId: speaker.id,
        decisionPoint: meta?.decisionPoint ?? false,
        error: failure ?? "Generation failed",
      };
    }

    return {
      status: "done",
      runId,
      beatId,
      speakerRoleId: speaker.id,
      decisionPoint: meta?.decisionPoint ?? false,
    };
  },
});
