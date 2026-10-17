import type { RoleCard } from "../convex/shared/contracts";

/** Valid role card factory for contract tests. */
export function makeRoleCard(overrides: Partial<RoleCard> = {}): RoleCard {
  return {
    identity: {
      name: "Linh",
      monogram: "L",
      ageEra: "Saigon, 1975",
      pronouns: "she/her",
      occupation: "debt collector",
      accentColor: "amber",
    },
    hook: "Collects debts she can never repay herself.",
    psychology: {
      traits: ["patient", "watchful", "dry"],
      dials: { warmth: 0.4, impulse: 0.3, guile: 0.8, optimism: 0.2 },
      flaws: ["proud", "cannot ask for help"],
      fears: ["being exposed"],
      desires: ["a clean name"],
      secret: "She owes the same syndicate she collects for.",
    },
    voice: {
      register: "low, deliberate",
      rhythm: "short sentences",
      verbosity: "terse",
      vocabularyNotes: "streetwise, unsentimental",
      verbalTics: ["'Fine.'"],
      sampleLines: ["Fine. We do it your way.", "You don't get to be surprised."],
      doNotSay: ["I love you"],
      narrationStyle: "observational, hands and doors",
    },
    drives: {
      publicGoal: "Collect the ledger before the week ends",
      secretGoal: "Buy her own name back",
      stakes: "Her life, quietly",
    },
    boundariesLines: ["Never hits first"],
    relations: [],
    meta: { storyRole: "protagonist", tier: "spotlight", modelTier: "spotlight" },
    ...overrides,
  };
}

export function makeOption(overrides: Record<string, unknown> = {}) {
  return {
    label: "Push inside",
    speakerRoleId: "role_1",
    text: "She pushes the door open and steps out of the rain.",
    strategy: "escalate",
    ...overrides,
  };
}
