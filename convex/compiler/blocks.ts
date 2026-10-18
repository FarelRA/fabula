import { renderTemplate, stableHash } from "../prompts/registry";
import { computeUsable, estimateTokens, renderBlocks, systemTokenBudget, SYSTEM_TARGET_PCT } from "../lib/tokenBudget";
import type { Block } from "../lib/tokenBudget";
import type { ChatMessage } from "../lib/gateway";
import type {
  CompiledBlock,
  CompileResult,
  ContextBeat,
  FactLine,
  ModelRef,
  NoteLine,
  PromptMode,
  RelationLine,
  RoleCardData,
  ScenePromptData,
  SummaryLine,
  TemplateMap,
} from "./types";

/**
 * Block builders, the ONLY place template prose meets runtime data.
 * Fixed block order: contract, identity, world, boundaries,
 * memory, relations, directorNotes, mode.
 */

export type BlockDraft = {
  key: string;
  templateKey: string;
  templateVersion: number;
  text: string;
};

export function requireTemplate(
  templates: TemplateMap,
  key: string,
): { key: string; version: number; content: string } {
  const found = templates[key];
  if (!found) {
    throw new Error(`Missing prompt template "${key}", seed the templates first`);
  }
  return found;
}

export function draftBlock(
  templates: TemplateMap,
  templateKey: string,
  blockKey: string,
  vars: Record<string, string | number>,
): BlockDraft {
  const template = requireTemplate(templates, templateKey);
  return {
    key: blockKey,
    templateKey: template.key,
    templateVersion: template.version,
    text: renderTemplate(template.content, vars),
  };
}

export function materializeBlock(draft: BlockDraft, text?: string): CompiledBlock {
  const finalText = text ?? draft.text;
  return {
    key: draft.key,
    templateKey: draft.templateKey,
    templateVersion: draft.templateVersion,
    text: finalText,
    hash: stableHash(finalText),
    tokens: estimateTokens(finalText),
    chars: finalText.length,
  };
}

// ---------------------------------------------------------------------------
// Rendering helpers (formats the fake gateway also parses, keep stable)
// ---------------------------------------------------------------------------

export function renderBeatLine(beat: ContextBeat): string {
  const speaker = beat.speakerName ?? "Narration";
  return `${speaker}: ${beat.text}`;
}

/** "id: Name (tier, storyRole)", parsed by the fake gateway. */
export function renderRoleLine(role: {
  id: string;
  name: string;
  tier: string;
  storyRole?: string;
}): string {
  return `${role.id}: ${role.name} (${role.tier}${role.storyRole ? `, ${role.storyRole}` : ""})`;
}

export function renderFactLines(facts: FactLine[]): string {
  if (facts.length === 0) return "- none yet.";
  return facts.map((fact) => `- ${fact.text}${fact.isPinned ? " (pinned)" : ""}`).join("\n");
}

export function renderSummaryText(summaries: SummaryLine[]): string {
  if (summaries.length === 0) return "none yet.";
  return [...summaries]
    .sort((a, b) => a.coveredThroughSeq - b.coveredThroughSeq)
    .slice(-2)
    .map((summary) => summary.text)
    .join(" ");
}

export function renderRelationLines(relations: RelationLine[]): string {
  if (relations.length === 0) return "- no other characters present.";
  return relations
    .map(
      (relation) =>
        `- ${relation.name}, ${relation.dynamic} (tension ${relation.tension.toFixed(2)}): ${relation.historyNote} Knows: ${relation.knowsAbout}`,
    )
    .join("\n");
}

export function renderNotes(notes: NoteLine[]): { steers: string; constraints: string; doNot: string } {
  const pick = (kind: NoteLine["kind"]): string => {
    const matching = notes.filter((note) => note.kind === kind).map((note) => note.text);
    return matching.length > 0 ? matching.join("; ") : "none.";
  };
  return { steers: pick("steer"), constraints: pick("constraint"), doNot: pick("doNot") };
}

const joinOrNone = (items: string[]): string => (items.length > 0 ? items.join("; ") : "none.");

export function styleFormatFor(style: ScenePromptData["presentationStyle"]): {
  styleFormat: string;
  narrationRule: string;
} {
  switch (style) {
    case "script":
      return {
        styleFormat:
          "NAME on its own line, dialogue beneath, stage directions in parentheses",
        narrationRule:
          "Stage directions (in parentheses) may describe the speaker's own actions only.",
      };
    case "novel":
      return {
        styleFormat:
          "third-person limited past-tense prose with quoted dialogue; no name prefixes",
        narrationRule:
          "Narration stays strictly inside the speaker's perspective and knowledge.",
      };
    default:
      return {
        styleFormat: "`Name: text` lines; short narration in italics on its own line",
        narrationRule:
          "Italic narration may describe the speaker's own actions only.",
      };
  }
}

export function lengthWordsFor(
  target: ScenePromptData["lengthTarget"],
  style: ScenePromptData["presentationStyle"],
): number {
  const table: Record<ScenePromptData["lengthTarget"], [number, number, number]> = {
    short: [60, 90, 160],
    medium: [110, 150, 260],
    long: [180, 240, 400],
  };
  const styleIndex = style === "chat" ? 0 : style === "script" ? 1 : 2;
  return table[target][styleIndex] ?? 150;
}

export function worldVars(scene: ScenePromptData): Record<string, string | number> {
  return {
    premise: scene.premise,
    genre: scene.genre,
    settingEra: scene.settingEra,
    presentationStyle: scene.presentationStyle,
    playLanguage: scene.playLanguage,
    comedicGrim: scene.tone.comedicGrim.toFixed(1),
    groundedFantastical: scene.tone.groundedFantastical.toFixed(1),
    romanceRivalry: scene.tone.romanceRivalry.toFixed(1),
  };
}

export function identityVars(role: RoleCardData): Record<string, string | number> {
  return {
    roleName: role.name,
    hook: role.hook,
    ageEra: role.ageEra,
    occupation: role.occupation,
    pronouns: role.pronouns,
    traits: joinOrNone(role.traits),
    warmth: role.dials.warmth.toFixed(2),
    impulse: role.dials.impulse.toFixed(2),
    guile: role.dials.guile.toFixed(2),
    optimism: role.dials.optimism.toFixed(2),
    flaws: joinOrNone(role.flaws),
    fears: joinOrNone(role.fears),
    desires: joinOrNone(role.desires),
    secret: role.secret,
    publicGoal: role.publicGoal,
    secretGoal: role.secretGoal,
    stakes: role.stakes,
    boundaries: joinOrNone(role.boundariesLines),
    register: role.register,
    rhythm: role.rhythm,
    verbosity: role.verbosity,
    verbalTics: joinOrNone(role.verbalTics),
    doNotSay: joinOrNone(role.doNotSay),
    sampleLines: joinOrNone(role.sampleLines),
  };
}

// ---------------------------------------------------------------------------
// Single-block finalize (meta modes: memory / casting / director)
// ---------------------------------------------------------------------------

export function finalizeSingleBlock(args: {
  templates: TemplateMap;
  templateKey: string;
  vars: Record<string, string | number>;
  messages: ChatMessage[];
  mode: PromptMode;
  model: ModelRef;
  contextWindow: number;
  outputReserve: number;
  /** true when the caller will retry with a smaller prompt. */
  compacted?: boolean;
}): CompileResult {
  const draft = draftBlock(args.templates, args.templateKey, "mode", args.vars);
  const systemBlock: Block = { key: draft.key, text: draft.text };
  const system = renderBlocks([systemBlock]);
  const systemTokens = estimateTokens(system);
  const contextTokens = args.messages.reduce(
    (sum, message) => sum + estimateTokens(message.content),
    0,
  );
  const usable = computeUsable(args.contextWindow, args.outputReserve);
  const overBudget = systemTokens > systemTokenBudget(usable) ||
    systemTokens + contextTokens + args.outputReserve > usable;

  return {
    system,
    messages: args.messages,
    snapshot: {
      mode: args.mode,
      blocks: [materializeBlock(draft)],
      model: {
        provider: args.model.provider,
        modelId: args.model.modelId,
        params: args.model.params ?? {},
      },
      tokenCounts: {
        system: systemTokens,
        context: contextTokens,
        outputReserve: args.outputReserve,
        total: systemTokens + contextTokens + args.outputReserve,
      },
      budget: {
        contextWindow: args.contextWindow,
        systemTargetPct: SYSTEM_TARGET_PCT,
        overBudgetAction: overBudget && !args.compacted ? "single-block over budget" : undefined,
      },
    },
  };
}
