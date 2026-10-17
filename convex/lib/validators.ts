import { v } from "convex/values";

/**
 * Validators shared across Convex functions (single source for arg shapes).
 */

export const presentationStyleV = v.union(
  v.literal("chat"),
  v.literal("script"),
  v.literal("novel"),
);

export const storyRoleV = v.union(
  v.literal("protagonist"),
  v.literal("antagonist"),
  v.literal("foil"),
  v.literal("wildcard"),
  v.literal("support"),
);

export const tierV = v.union(
  v.literal("spotlight"),
  v.literal("supporting"),
  v.literal("background"),
);

export const modelTierV = v.union(
  v.literal("spotlight"),
  v.literal("standard"),
  v.literal("cheap"),
);

export const turnModeV = v.union(
  v.literal("roundRobin"),
  v.literal("reactive"),
  v.literal("directorLed"),
  v.literal("freeform"),
);

export const branchFrequencyV = v.union(
  v.literal("always"),
  v.literal("key"),
  v.literal("onDemand"),
);

export const lengthTargetV = v.union(v.literal("short"), v.literal("medium"), v.literal("long"));

export const relationDynamicV = v.union(
  v.literal("ally"),
  v.literal("rival"),
  v.literal("lover"),
  v.literal("mentor"),
  v.literal("enemy"),
  v.literal("family"),
  v.literal("stranger"),
);

export const generationModeV = v.union(
  v.literal("turn"),
  v.literal("options"),
  v.literal("summary"),
  v.literal("facts"),
  v.literal("casting"),
  v.literal("directorMeta"),
  v.literal("sampleLine"),
);

export const roleStatusV = v.union(
  v.literal("active"),
  v.literal("offstage"),
  v.literal("retired"),
);

export const toneDialsV = v.object({
  comedicGrim: v.number(),
  groundedFantastical: v.number(),
  romanceRivalry: v.number(),
});

export const boundariesV = v.object({
  allowed: v.array(v.string()),
  blocked: v.array(v.string()),
});

export const turnRulesV = v.object({
  mode: turnModeV,
  autoBurst: v.boolean(),
  burstMax: v.number(),
  abortedKeepsPartial: v.boolean(),
});

export const settingsV = v.object({
  genre: v.string(),
  settingEra: v.string(),
  presentationStyle: presentationStyleV,
  playLanguage: v.string(),
  tone: toneDialsV,
  boundaries: boundariesV,
  turnRules: turnRulesV,
  branchFrequency: branchFrequencyV,
  optionsDefaultCount: v.number(),
  contextBeatsK: v.number(),
  summaryEveryN: v.number(),
  lengthTarget: lengthTargetV,
  budget: v.object({ softUsdCap: v.optional(v.number()) }),
});

export const relationV = v.object({
  toRoleId: v.id("roles"),
  dynamic: relationDynamicV,
  tension: v.number(),
  historyNote: v.string(),
  knowsAbout: v.string(),
});

export const roleCardV = v.object({
  identity: v.object({
    name: v.string(),
    monogram: v.string(),
    ageEra: v.string(),
    pronouns: v.string(),
    occupation: v.string(),
    accentColor: v.string(),
    avatarPrompt: v.optional(v.string()),
  }),
  hook: v.string(),
  psychology: v.object({
    traits: v.array(v.string()),
    dials: v.object({
      warmth: v.number(),
      impulse: v.number(),
      guile: v.number(),
      optimism: v.number(),
    }),
    flaws: v.array(v.string()),
    fears: v.array(v.string()),
    desires: v.array(v.string()),
    secret: v.string(),
  }),
  voice: v.object({
    register: v.string(),
    rhythm: v.string(),
    verbosity: v.string(),
    vocabularyNotes: v.string(),
    verbalTics: v.array(v.string()),
    sampleLines: v.array(v.string()),
    doNotSay: v.array(v.string()),
    narrationStyle: v.string(),
  }),
  drives: v.object({
    publicGoal: v.string(),
    secretGoal: v.string(),
    stakes: v.string(),
  }),
  boundariesLines: v.array(v.string()),
  relations: v.array(relationV),
  meta: v.object({
    storyRole: storyRoleV,
    tier: tierV,
    modelTier: modelTierV,
    temperature: v.optional(v.number()),
  }),
});
