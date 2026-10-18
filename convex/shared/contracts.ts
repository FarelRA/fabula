import { z } from "zod";

// ---------------------------------------------------------------------------
// Fabula shared contracts: output schemas and value objects.
// Imported by Convex functions (generation outputs) and by the app (forms,
// fixtures). Every AI structured output must parse against these schemas
// before it is persisted.
// ---------------------------------------------------------------------------

export const PresentationStyleSchema = z.enum(["chat", "script", "novel"]);
export const StoryRoleSchema = z.enum([
  "protagonist",
  "antagonist",
  "foil",
  "wildcard",
  "support",
]);
export const TierSchema = z.enum(["spotlight", "supporting", "background"]);
export const ModelTierSchema = z.enum(["spotlight", "standard", "cheap"]);
export const TurnModeSchema = z.enum(["roundRobin", "reactive", "directorLed", "freeform"]);
export const BranchFrequencySchema = z.enum(["always", "key", "onDemand"]);
export const LengthTargetSchema = z.enum(["short", "medium", "long"]);
export const RelationDynamicSchema = z.enum([
  "ally",
  "rival",
  "lover",
  "mentor",
  "enemy",
  "family",
  "stranger",
]);
export const StrategySchema = z.enum([
  "escalate",
  "de-escalate",
  "reveal",
  "conceal",
  "ally",
  "confront",
  "commit",
  "deflect",
]);
export const GenerationModeSchema = z.enum([
  "turn",
  "options",
  "summary",
  "facts",
  "casting",
  "directorMeta",
  "sampleLine",
  "castRegen",
  "fieldRegen",
  "continuity",
]);

/** Strategies that change scene state. */
export const STATE_CHANGING_STRATEGIES = ["escalate", "reveal", "confront", "commit"] as const;

export const ToneDialsSchema = z.object({
  comedicGrim: z.number().min(-1).max(1),
  groundedFantastical: z.number().min(-1).max(1),
  romanceRivalry: z.number().min(-1).max(1),
});

export const BoundariesSchema = z.object({
  allowed: z.array(z.string()),
  blocked: z.array(z.string()),
});

export const TurnRulesSchema = z.object({
  mode: TurnModeSchema,
  autoBurst: z.boolean(),
  burstMax: z.number().int().min(1).max(5),
  abortedKeepsPartial: z.boolean(),
});

export const SceneSettingsSchema = z.object({
  genre: z.string(),
  settingEra: z.string(),
  presentationStyle: PresentationStyleSchema,
  playLanguage: z.string(),
  tone: ToneDialsSchema,
  boundaries: BoundariesSchema,
  turnRules: TurnRulesSchema,
  branchFrequency: BranchFrequencySchema,
  optionsDefaultCount: z.number().int().min(2).max(4),
  contextBeatsK: z.number().int().min(4).max(80),
  summaryEveryN: z.number().int().min(2).max(20),
  lengthTarget: LengthTargetSchema,
  budget: z.object({ softUsdCap: z.number().optional() }),
});

export const RelationSchema = z.object({
  toRoleId: z.string(),
  dynamic: RelationDynamicSchema,
  tension: z.number().min(0).max(1),
  historyNote: z.string(),
  knowsAbout: z.string(),
});

export const RoleCardSchema = z.object({
  identity: z.object({
    name: z.string().min(1),
    monogram: z.string().min(1).max(4),
    ageEra: z.string(),
    pronouns: z.string(),
    occupation: z.string(),
    accentColor: z.string(),
  }),
  hook: z.string().min(1),
  psychology: z.object({
    traits: z.array(z.string()),
    dials: z.object({
      warmth: z.number().min(0).max(1),
      impulse: z.number().min(0).max(1),
      guile: z.number().min(0).max(1),
      optimism: z.number().min(0).max(1),
    }),
    flaws: z.array(z.string()),
    fears: z.array(z.string()),
    desires: z.array(z.string()),
    secret: z.string(),
  }),
  voice: z.object({
    register: z.string(),
    rhythm: z.string(),
    verbosity: z.string(),
    vocabularyNotes: z.string(),
    verbalTics: z.array(z.string()),
    sampleLines: z.array(z.string()).min(2).max(3),
    doNotSay: z.array(z.string()),
    narrationStyle: z.string(),
  }),
  drives: z.object({
    publicGoal: z.string(),
    secretGoal: z.string(),
    stakes: z.string(),
  }),
  boundariesLines: z.array(z.string()),
  relations: z.array(RelationSchema),
  meta: z.object({
    storyRole: StoryRoleSchema,
    tier: TierSchema,
    modelTier: ModelTierSchema,
    temperature: z.number().min(0).max(2).optional(),
  }),
});

export const RoleListSchema = z.object({
  roles: z.array(RoleCardSchema).min(1).max(8),
});

export const CastingSchema = RoleListSchema.extend({
  premise: z.string().min(1),
});

/** Field regen returns a patch object; the action validates it field-by-field. */
export const FieldRegenSchema = z.object({
  fields: z.record(z.string(), z.unknown()),
});

const labelWords = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;

export const PathOptionSchema = z.object({
  label: z
    .string()
    .refine((s) => labelWords(s) >= 2 && labelWords(s) <= 4, "label must be 2 to 4 words"),
  speakerRoleId: z.string(),
  text: z.string().min(1),
  strategy: StrategySchema,
});

export const PathOptionsSchema = z.object({
  options: z.array(PathOptionSchema).min(2).max(4),
});

export const SummarySchema = z
  .object({
    summary: z.string().min(1),
    coveredFromSeq: z.number().int().nonnegative(),
    coveredThroughSeq: z.number().int().nonnegative(),
  })
  .refine((s) => s.coveredFromSeq <= s.coveredThroughSeq, {
    message: "coveredFromSeq must be ≤ coveredThroughSeq",
  });

export const FactsSchema = z.object({
  facts: z.array(
    z.object({
      text: z.string().min(1),
      subjects: z.array(z.string()),
      visibility: z.enum(["public", "private"]),
      nodeId: z.string(),
    }),
  ),
});

export const DirectorMetaSchema = z.object({
  decisionPoint: z.boolean(),
  reason: z.string(),
  responders: z.array(z.string()),
  pacingNote: z.string(),
  endingSuggested: z.boolean(),
});

export const SampleLinesSchema = z.object({
  lines: z.array(z.string()).min(2).max(3),
});

export const ContinuitySchema = z.object({
  warnings: z.array(
    z.object({
      text: z.string().min(1),
      severity: z.enum(["low", "medium", "high"]),
    }),
  ),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PresentationStyle = z.infer<typeof PresentationStyleSchema>;
export type StoryRole = z.infer<typeof StoryRoleSchema>;
export type Tier = z.infer<typeof TierSchema>;
export type ModelTier = z.infer<typeof ModelTierSchema>;
export type TurnMode = z.infer<typeof TurnModeSchema>;
export type BranchFrequency = z.infer<typeof BranchFrequencySchema>;
export type LengthTarget = z.infer<typeof LengthTargetSchema>;
export type Strategy = z.infer<typeof StrategySchema>;
export type GenerationMode = z.infer<typeof GenerationModeSchema>;
export type ToneDials = z.infer<typeof ToneDialsSchema>;
export type Boundaries = z.infer<typeof BoundariesSchema>;
export type TurnRules = z.infer<typeof TurnRulesSchema>;
export type SceneSettings = z.infer<typeof SceneSettingsSchema>;
export type Relation = z.infer<typeof RelationSchema>;
export type RoleCard = z.infer<typeof RoleCardSchema>;
export type Casting = z.infer<typeof CastingSchema>;
export type RoleList = z.infer<typeof RoleListSchema>;
export type FieldRegen = z.infer<typeof FieldRegenSchema>;
export type PathOption = z.infer<typeof PathOptionSchema>;
export type PathOptions = z.infer<typeof PathOptionsSchema>;
export type Summary = z.infer<typeof SummarySchema>;
export type Facts = z.infer<typeof FactsSchema>;
export type DirectorMeta = z.infer<typeof DirectorMetaSchema>;
export type SampleLines = z.infer<typeof SampleLinesSchema>;
export type Continuity = z.infer<typeof ContinuitySchema>;
