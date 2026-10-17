import { convexTest } from "convex-test";
import { register as registerAgent } from "@convex-dev/agent/test";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";

// Deterministic model layer for the whole backend suite (real providers are
// never called in tests or CI — PLAN §11.1).
process.env.FABULA_MODEL_FAKE = "1";

/**
 * convex-test harness. Test files live OUTSIDE convex/ so they are never
 * deployed; module keys are normalized to the canonical "./scenes.ts" form
 * relative to the convex root.
 */

// Pattern matches .ts and .js like the documented convex-test glob. The
// "_generated" directory MUST be included: convex-test uses it to locate the
// modules root. Keys are normalized to "./scenes.ts" (relative to convex/).
const rawModules = import.meta.glob("../../convex/**/*.*s");

const modules: Record<string, () => Promise<unknown>> = Object.fromEntries(
  Object.entries(rawModules)
    .filter(([key]) => !key.includes(".test."))
    .map(([key, loader]) => [key.replace(/^\.\.\/\.\.\/convex\//, "./"), loader]),
);

export function makeT() {
  const t = convexTest(schema, modules);
  registerAgent(t);
  return t;
}

export type T = ReturnType<typeof makeT>;

export async function makeUser(t: T, name = "Owner"): Promise<string> {
  return await t.run(async (ctx) => await ctx.db.insert("users", { name }));
}

export async function makeAnonymousUser(t: T): Promise<string> {
  return await t.run(async (ctx) => await ctx.db.insert("users", { name: "Visitor", isAnonymous: true }));
}

export function asUser(t: T, userId: string) {
  return t.withIdentity({ subject: userId, tokenIdentifier: `test|${userId}` });
}

export function defaultSettings() {
  return {
    genre: "noir",
    settingEra: "Saigon, 1975",
    presentationStyle: "chat" as const,
    playLanguage: "en",
    tone: { comedicGrim: -0.4, groundedFantastical: -0.6, romanceRivalry: 0.2 },
    boundaries: { allowed: ["tension"], blocked: ["graphic violence"] },
    turnRules: {
      mode: "reactive" as const,
      autoBurst: false,
      burstMax: 2,
      abortedKeepsPartial: true,
    },
    branchFrequency: "key" as const,
    optionsDefaultCount: 3,
    contextBeatsK: 30,
    summaryEveryN: 6,
    lengthTarget: "medium" as const,
    budget: {},
  };
}

export function makeCard(name = "Linh") {
  return {
    identity: {
      name,
      monogram: name.slice(0, 1).toUpperCase() || "L",
      ageEra: "Saigon, 1975",
      pronouns: "she/her",
      occupation: "debt collector",
      accentColor: "amber",
    },
    hook: "Collects debts she can never repay herself.",
    psychology: {
      traits: ["patient", "watchful"],
      dials: { warmth: 0.4, impulse: 0.3, guile: 0.8, optimism: 0.2 },
      flaws: ["proud"],
      fears: ["exposure"],
      desires: ["a clean name"],
      secret: "She owes the same syndicate.",
    },
    voice: {
      register: "low, deliberate",
      rhythm: "short sentences",
      verbosity: "terse",
      vocabularyNotes: "streetwise",
      verbalTics: ["'Fine.'"],
      sampleLines: ["Fine. We do it your way.", "You don't get to be surprised."],
      doNotSay: ["I love you"],
      narrationStyle: "observational",
    },
    drives: {
      publicGoal: "Collect the ledger",
      secretGoal: "Buy her name back",
      stakes: "Her life, quietly",
    },
    boundariesLines: ["Never hits first"],
    relations: [],
    meta: {
      storyRole: "protagonist" as const,
      tier: "spotlight" as const,
      modelTier: "spotlight" as const,
    },
  };
}

export async function seedScene(t: T, userId: string) {
  const client = asUser(t, userId);
  // Prompt templates are deployment data; tests bootstrap them like a fresh
  // self-host would (idempotent).
  await client.mutation(api.prompts.seed.seedV1, {});
  const created = await client.mutation(api.scenes.create, {
    title: "The Glass Harbor",
    premise: "A debt collector knocks on the wrong door.",
    settings: defaultSettings(),
  });
  return { sceneId: created.sceneId, branchId: created.branchId, client };
}

export async function seedPlayableScene(t: T, userId: string) {
  const seeded = await seedScene(t, userId);
  const opener = await seeded.client.mutation(api.beats.appendOpening, {
    sceneId: seeded.sceneId,
    text: "Rain hadn't stopped for three days when she knocked.",
  });
  return { ...seeded, openerBeatId: opener.beatId };
}
