import { finalizeSingleBlock, renderBeatLine } from "./blocks";
import type { CompileResult, ContextBeat, ModelRef, TemplateMap } from "./types";

/**
 * Memory-agent prompts (PLAN §7.4): summary, facts, continuity.
 */

export function compileSummaryPrompt(args: {
  templates: TemplateMap;
  model: ModelRef;
  window: ContextBeat[];
  fromSeq: number;
  throughSeq: number;
  contextWindow: number;
  outputReserve: number;
}): CompileResult {
  return finalizeSingleBlock({
    templates: args.templates,
    templateKey: "mode.summary",
    vars: { fromSeq: args.fromSeq, throughSeq: args.throughSeq },
    messages: [
      {
        role: "user",
        content: `Beats in scope:\n${args.window.map(renderBeatLine).join("\n") || "(none)"}`,
      },
    ],
    mode: "summary",
    model: args.model,
    contextWindow: args.contextWindow,
    outputReserve: args.outputReserve,
  });
}

export function compileFactsPrompt(args: {
  templates: TemplateMap;
  model: ModelRef;
  window: ContextBeat[];
  fromSeq: number;
  existingFacts: string[];
  max: number;
  contextWindow: number;
  outputReserve: number;
}): CompileResult {
  const windowLines = args.window
    .map(
      (beat) =>
        `- beat ${beat.id} (seq ${beat.seq}${beat.speakerName ? `, ${beat.speakerName}` : ""}): ${beat.text}`,
    )
    .join("\n");
  return finalizeSingleBlock({
    templates: args.templates,
    templateKey: "mode.facts",
    vars: {
      fromSeq: args.fromSeq,
      max: args.max,
      existing: args.existingFacts.length > 0 ? args.existingFacts.join("; ") : "none",
      window: windowLines || "(none)",
    },
    messages: [{ role: "user", content: "Extract facts from the beats in scope." }],
    mode: "facts",
    model: args.model,
    contextWindow: args.contextWindow,
    outputReserve: args.outputReserve,
  });
}

export function compileContinuityPrompt(args: {
  templates: TemplateMap;
  model: ModelRef;
  recentBeats: ContextBeat[];
  facts: string[];
  contextWindow: number;
  outputReserve: number;
}): CompileResult {
  return finalizeSingleBlock({
    templates: args.templates,
    templateKey: "meta.continuity",
    vars: {
      recentBeats: args.recentBeats.map(renderBeatLine).join("\n") || "(none)",
      facts: args.facts.length > 0 ? args.facts.join("; ") : "none",
    },
    messages: [{ role: "user", content: "Report contradictions, or return none." }],
    mode: "continuity",
    model: args.model,
    contextWindow: args.contextWindow,
    outputReserve: args.outputReserve,
  });
}
