import type { StoryRole, Tier } from "@convex/shared/contracts";
import { ROLE_ACCENTS, hashSeed, roleAccent } from "./avatar";
import { modelTierFor } from "./tierPolicy";
import type { CastRole, RoleCard } from "./types";

/**
 * Blank/duplicate role construction and deterministic ids for the
 * fixtures session. Live mode receives ids from Convex.
 */

export function deriveTitle(premise: string): string {
  const words = premise.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (words.length === 0) return "Untitled scene";
  const clipped = words
    .slice(0, 7)
    .join(" ")
    .replace(/[.,;:!?]+$/u, "");
  // Never end a title on a dangling function word.
  const trimmed = clipped.replace(
    /\s+(?:a|an|the|and|of|to|in|on|at|for|with|by)$/iu,
    "",
  );
  return trimmed.replace(/^./u, (character) => character.toLocaleUpperCase());
}

export function fixtureId(prefix: string, seed: string): string {
  return `${prefix}_${hashSeed(seed).toString(36)}`;
}

export function blankRoleCard(index: number, storyRole: StoryRole = "support"): RoleCard {
  const accent = ROLE_ACCENTS[index % ROLE_ACCENTS.length] ?? "amber";
  const suffix = index + 1;
  return {
    identity: {
      name: `New role ${suffix}`,
      monogram: "N",
      ageEra: "unspecified",
      pronouns: "they/them",
      occupation: "unwritten",
      accentColor: accent,
    },
    hook: "A role waiting for a history.",
    psychology: {
      traits: ["watchful", "guarded"],
      dials: { warmth: 0.5, impulse: 0.5, guile: 0.5, optimism: 0.5 },
      flaws: ["keeps score"],
      fears: ["being seen"],
      desires: ["a clean exit"],
      secret: "They know why the door was left unlocked.",
    },
    voice: {
      register: "low, measured",
      rhythm: "short sentences with long pauses",
      verbosity: "sparing",
      vocabularyNotes: "plain words, occasional trade jargon",
      verbalTics: ["taps a knuckle twice"],
      sampleLines: ["You came to the wrong door.", "I only match names to faces."],
      doNotSay: ["As an AI", "I cannot"],
      narrationStyle: "observes before acting",
    },
    drives: {
      publicGoal: "Get through the night without owing anyone.",
      secretGoal: "Find the person who left them the ledger.",
      stakes: "If the truth surfaces, the wrong people will hear it.",
    },
    boundariesLines: ["Won't hurt children", "Won't break a promise made in rain"],
    relations: [],
    meta: {
      storyRole,
      tier: "supporting",
      modelTier: modelTierFor("supporting"),
    },
  };
}

export function blankRole(newId: string, index: number): CastRole {
  return {
    id: newId,
    kind: "ai",
    card: blankRoleCard(index),
    status: "active",
    draftLocks: [],
    sampleLines: undefined,
  } satisfies CastRole;
}

export function duplicateRole(role: CastRole, newId: string): CastRole {
  const card = JSON.parse(JSON.stringify(role.card)) as RoleCard;
  card.identity = {
    ...card.identity,
    name: `${card.identity.name} (copy)`,
    monogram: card.identity.monogram,
  };
  card.relations = card.relations
    .filter((relation) => relation.toRoleId !== role.id)
    .map((relation) => ({ ...relation }));
  return {
    ...role,
    id: newId,
    card,
    draftLocks: [],
    currentRevisionId: undefined,
    sampleLines: undefined,
  };
}

export function tierForIndex(index: number, tiers: readonly Tier[]): Tier {
  return tiers[index] ?? "background";
}

export function resolveAccent(value: string): string {
  return roleAccent(value);
}
