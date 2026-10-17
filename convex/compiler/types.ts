import type { ChatMessage } from "../lib/gateway";

/**
 * Prompt compiler types (PLAN §7). The compiler is pure: DB access happens in
 * the callers; everything here is plain data in, deterministic output out.
 */

export type TemplateMap = Record<string, { key: string; version: number; content: string }>;

export type PromptMode =
  | "turn"
  | "options"
  | "summary"
  | "facts"
  | "casting"
  | "directorMeta"
  | "sampleLine"
  | "castRegen"
  | "fieldRegen"
  | "continuity";

export type ModelRef = {
  provider: string;
  modelId: string;
  /** "provider/model" as configured. */
  ref: string;
  params?: Record<string, unknown>;
};

export type ScenePromptData = {
  title: string;
  premise: string;
  genre: string;
  settingEra: string;
  presentationStyle: "chat" | "script" | "novel";
  playLanguage: string;
  tone: { comedicGrim: number; groundedFantastical: number; romanceRivalry: number };
  boundaries: { allowed: string[]; blocked: string[] };
  lengthTarget: "short" | "medium" | "long";
  branchFrequency: "always" | "key" | "onDemand";
  turnMode: "roundRobin" | "reactive" | "directorLed" | "freeform";
  contextBeatsK: number;
};

export type RoleCardData = {
  id: string;
  name: string;
  hook: string;
  ageEra: string;
  occupation: string;
  pronouns: string;
  traits: string[];
  dials: { warmth: number; impulse: number; guile: number; optimism: number };
  flaws: string[];
  fears: string[];
  desires: string[];
  secret: string;
  register: string;
  rhythm: string;
  verbosity: string;
  verbalTics: string[];
  sampleLines: string[];
  doNotSay: string[];
  narrationStyle: string;
  publicGoal: string;
  secretGoal: string;
  stakes: string;
  boundariesLines: string[];
  tier: "spotlight" | "supporting" | "background";
  modelTier: "spotlight" | "standard" | "cheap";
};

export type RelationLine = {
  name: string;
  dynamic: string;
  tension: number;
  historyNote: string;
  knowsAbout: string;
};

export type FactLine = { text: string; isPinned: boolean; subjects: string[] };

export type SummaryLine = { text: string; coveredThroughSeq: number };

export type NoteLine = { kind: "steer" | "constraint" | "doNot"; text: string };

export type ContextBeat = {
  id: string;
  seq: number;
  speakerRoleId?: string;
  speakerName?: string;
  text: string;
  isPinned: boolean;
};

export type CompiledBlock = {
  key: string;
  templateKey?: string;
  templateVersion?: number;
  text: string;
  hash: string;
  tokens: number;
  chars: number;
};

export type SnapshotDraft = {
  mode: PromptMode;
  blocks: CompiledBlock[];
  model: { provider: string; modelId: string; params: Record<string, unknown> };
  tokenCounts: { system: number; context: number; outputReserve: number; total: number };
  budget: { contextWindow: number; systemTargetPct: number; overBudgetAction?: string };
};

export type CompileResult = {
  system: string;
  messages: ChatMessage[];
  snapshot: SnapshotDraft;
};

export type ModeInput =
  | { kind: "turn" }
  | { kind: "options"; count: number; responderIds: string[] }
  | { kind: "sampleLine" };

export type CompileRolePromptArgs = {
  templates: TemplateMap;
  role: RoleCardData;
  scene: ScenePromptData;
  relations: RelationLine[];
  facts: FactLine[];
  summaries: SummaryLine[];
  notes: NoteLine[];
  contextBeats: ContextBeat[];
  mode: ModeInput;
  model: ModelRef;
  contextWindow: number;
  outputReserve: number;
};

export function outputReserveFor(lengthTarget: "short" | "medium" | "long"): number {
  switch (lengthTarget) {
    case "short":
      return 400;
    case "long":
      return 1600;
    default:
      return 800;
  }
}
