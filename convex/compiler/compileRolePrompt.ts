import { estimateTokens, fitToBudget, renderBlocks, SYSTEM_TARGET_PCT } from "../lib/tokenBudget";
import type { Block } from "../lib/tokenBudget";
import type { ChatMessage } from "../lib/gateway";
import {
  draftBlock,
  identityVars,
  lengthWordsFor,
  materializeBlock,
  renderBeatLine,
  renderFactLines,
  renderNotes,
  renderRelationLines,
  renderSummaryText,
  styleFormatFor,
  worldVars,
  type BlockDraft,
} from "./blocks";
import type {
  CompileResult,
  CompileRolePromptArgs,
  CompiledBlock,
  SnapshotDraft,
} from "./types";

/**
 * compileRolePrompt, the heart of role quality.
 *
 * Pure and deterministic: fixed block order, path-filtered context (the
 * caller passes the active-path projection), token-budget compaction, and a
 * snapshot for the prompt inspector. Same input ⇒ byte-identical output.
 */

export function compileRolePrompt(args: CompileRolePromptArgs): CompileResult {
  const drafts: BlockDraft[] = [
    draftBlock(args.templates, "contract.roleplay", "contract", {
      roleName: args.role.name,
    }),
    draftBlock(args.templates, "identity", "identity", identityVars(args.role)),
    draftBlock(args.templates, "world", "world", worldVars(args.scene)),
    draftBlock(args.templates, "boundaries", "boundaries", {
      allowed:
        args.scene.boundaries.allowed.length > 0
          ? args.scene.boundaries.allowed.join("; ")
          : "none specified",
      blocked:
        args.scene.boundaries.blocked.length > 0
          ? args.scene.boundaries.blocked.join("; ")
          : "none specified",
    }),
    draftBlock(args.templates, "memory", "memory", {
      summary: renderSummaryText(args.summaries),
      facts: renderFactLines(args.facts),
    }),
    draftBlock(args.templates, "relations", "relations", {
      relations: renderRelationLines(args.relations),
    }),
    draftBlock(args.templates, "directorNotes", "directorNotes", renderNotes(args.notes)),
    modeDraft(args),
  ];

  const sorted = [...args.contextBeats].sort((a, b) => a.seq - b.seq);
  const window = sorted.slice(-args.scene.contextBeatsK);
  const windowIds = new Set(window.map((beat) => beat.id));
  const pinnedExtras = sorted.filter((beat) => beat.isPinned && !windowIds.has(beat.id));

  const contextBlocks: Block[] = window.map((beat) => ({
    key: beat.id,
    text: renderBeatLine(beat),
  }));

  const fit = fitToBudget({
    blocks: drafts.map((draft) => ({ key: draft.key, text: draft.text })),
    context: contextBlocks,
    contextWindow: args.contextWindow,
    outputReserve: args.outputReserve,
    minContextBeats: Math.min(4, window.length),
  });

  const system = renderBlocks(fit.blocks);

  const beatById = new Map(window.map((beat) => [beat.id, beat]));
  const messages: ChatMessage[] = [];
  if (pinnedExtras.length > 0) {
    messages.push({
      role: "user",
      content: `Pinned canon (always in context):\n${pinnedExtras.map(renderBeatLine).join("\n")}`,
    });
  }
  for (const block of fit.context) {
    const beat = beatById.get(block.key);
    if (!beat) continue;
    messages.push({
      role: beat.speakerRoleId === args.role.id ? "assistant" : "user",
      content: block.text,
    });
  }

  const draftByKey = new Map(drafts.map((draft) => [draft.key, draft]));
  const compiledBlocks: CompiledBlock[] = fit.blocks.map((block) => {
    const draft = draftByKey.get(block.key);
    return materializeBlock(
      {
        key: block.key,
        templateKey: draft?.templateKey ?? "unknown",
        templateVersion: draft?.templateVersion ?? 0,
        text: block.text,
      },
      block.text,
    );
  });

  const contextTokens =
    fit.context.reduce((sum, block) => sum + estimateTokens(block.text), 0) +
    (pinnedExtras.length > 0
      ? estimateTokens(pinnedExtras.map(renderBeatLine).join("\n"))
      : 0);

  const snapshot: SnapshotDraft = {
    mode: args.mode.kind,
    blocks: compiledBlocks,
    model: {
      provider: args.model.provider,
      modelId: args.model.modelId,
      params: args.model.params ?? {},
    },
    tokenCounts: {
      system: fit.systemTokens,
      context: contextTokens,
      outputReserve: args.outputReserve,
      total: fit.systemTokens + contextTokens + args.outputReserve,
    },
    budget: {
      contextWindow: args.contextWindow,
      systemTargetPct: SYSTEM_TARGET_PCT,
      overBudgetAction: fit.overBudget ? "compacted (context dropped / blocks shrunk)" : undefined,
    },
  };

  return { system, messages, snapshot };
}

function modeDraft(args: CompileRolePromptArgs): BlockDraft {
  switch (args.mode.kind) {
    case "options":
      return draftBlock(args.templates, "mode.options", "mode", {
        count: args.mode.count,
        presentationStyle: args.scene.presentationStyle,
        lengthTarget: args.scene.lengthTarget,
        roleIds: args.mode.responderIds.join(", "),
      });
    case "sampleLine":
      return draftBlock(args.templates, "mode.sampleLine", "mode", {
        roleName: args.role.name,
        hook: args.role.hook,
        register: args.role.register,
        rhythm: args.role.rhythm,
        tics: args.role.verbalTics.length > 0 ? args.role.verbalTics.join("; ") : "none",
        doNotSay: args.role.doNotSay.length > 0 ? args.role.doNotSay.join("; ") : "none",
      });
    default: {
      const { styleFormat, narrationRule } = styleFormatFor(args.scene.presentationStyle);
      return draftBlock(args.templates, "mode.turn", "mode", {
        roleName: args.role.name,
        presentationStyle: args.scene.presentationStyle,
        lengthTarget: args.scene.lengthTarget,
        styleFormat,
        narrationRule,
        lengthWords: lengthWordsFor(args.scene.lengthTarget, args.scene.presentationStyle),
      });
    }
  }
}
