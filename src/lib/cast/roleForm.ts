import { z } from "zod";
import {
  RoleCardSchema,
  StoryRoleSchema,
  TierSchema,
  type RoleCard,
} from "@convex/shared/contracts";
import { ROLE_ACCENTS } from "./avatar";
import { modelTierFor } from "./tierPolicy";
import { splitList } from "./wizard";

/**
 * Role card editor form: RHF + zod, one schema for AI
 * and human roles. Lists edit as comma/newline separated text, then the card
 * is re-validated through the frozen RoleCard contract before saving.
 */

export const roleFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(60),
  monogram: z.string().trim().min(1, "Monogram is required.").max(4),
  pronouns: z.string().trim().max(40),
  ageEra: z.string().trim().max(80),
  occupation: z.string().trim().max(80),
  accentColor: z.enum(ROLE_ACCENTS),
  hook: z.string().trim().min(1, "A hook is required.").max(240),
  traits: z.string().max(300),
  flaws: z.string().max(300),
  fears: z.string().max(300),
  desires: z.string().max(300),
  secret: z.string().trim().max(500),
  register: z.string().max(160),
  rhythm: z.string().max(160),
  verbosity: z.string().max(80),
  vocabularyNotes: z.string().max(240),
  verbalTics: z.string().max(240),
  doNotSay: z.string().max(240),
  narrationStyle: z.string().max(240),
  publicGoal: z.string().max(300),
  secretGoal: z.string().max(300),
  stakes: z.string().max(300),
  boundariesLines: z.string().max(500),
  warmth: z.number().min(0).max(1),
  impulse: z.number().min(0).max(1),
  guile: z.number().min(0).max(1),
  optimism: z.number().min(0).max(1),
  storyRole: StoryRoleSchema,
  tier: TierSchema,
});

export type RoleFormValues = z.infer<typeof roleFormSchema>;

function listToText(values: readonly string[]): string {
  return values.join(", ");
}

export function roleValuesFromCard(card: RoleCard): RoleFormValues {
  return {
    name: card.identity.name,
    monogram: card.identity.monogram,
    pronouns: card.identity.pronouns,
    ageEra: card.identity.ageEra,
    occupation: card.identity.occupation,
    accentColor: (ROLE_ACCENTS as readonly string[]).includes(card.identity.accentColor)
      ? (card.identity.accentColor as (typeof ROLE_ACCENTS)[number])
      : "amber",
    hook: card.hook,
    traits: listToText(card.psychology.traits),
    flaws: listToText(card.psychology.flaws),
    fears: listToText(card.psychology.fears),
    desires: listToText(card.psychology.desires),
    secret: card.psychology.secret,
    register: card.voice.register,
    rhythm: card.voice.rhythm,
    verbosity: card.voice.verbosity,
    vocabularyNotes: card.voice.vocabularyNotes,
    verbalTics: listToText(card.voice.verbalTics),
    doNotSay: listToText(card.voice.doNotSay),
    narrationStyle: card.voice.narrationStyle,
    publicGoal: card.drives.publicGoal,
    secretGoal: card.drives.secretGoal,
    stakes: card.drives.stakes,
    boundariesLines: card.boundariesLines.join("\n"),
    warmth: card.psychology.dials.warmth,
    impulse: card.psychology.dials.impulse,
    guile: card.psychology.dials.guile,
    optimism: card.psychology.dials.optimism,
    storyRole: card.meta.storyRole,
    tier: card.meta.tier,
  };
}

export function cardFromRoleValues(values: RoleFormValues, base: RoleCard): RoleCard {
  const nextTier = values.tier;
  const card: RoleCard = {
    ...base,
    identity: {
      ...base.identity,
      name: values.name.trim(),
      monogram: (values.monogram.trim() || values.name.trim().charAt(0)).slice(0, 4),
      pronouns: values.pronouns.trim(),
      ageEra: values.ageEra.trim(),
      occupation: values.occupation.trim(),
      accentColor: values.accentColor,
    },
    hook: values.hook.trim(),
    psychology: {
      traits: splitList(values.traits),
      dials: {
        warmth: values.warmth,
        impulse: values.impulse,
        guile: values.guile,
        optimism: values.optimism,
      },
      flaws: splitList(values.flaws),
      fears: splitList(values.fears),
      desires: splitList(values.desires),
      secret: values.secret.trim(),
    },
    voice: {
      ...base.voice,
      register: values.register.trim(),
      rhythm: values.rhythm.trim(),
      verbosity: values.verbosity.trim(),
      vocabularyNotes: values.vocabularyNotes.trim(),
      verbalTics: splitList(values.verbalTics),
      doNotSay: splitList(values.doNotSay),
      narrationStyle: values.narrationStyle.trim(),
      sampleLines:
        base.voice.sampleLines.length >= 2
          ? base.voice.sampleLines
          : ["Say it plainly.", "Then say it again in the rain."],
    },
    drives: {
      publicGoal: values.publicGoal.trim(),
      secretGoal: values.secretGoal.trim(),
      stakes: values.stakes.trim(),
    },
    boundariesLines: values.boundariesLines
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
    meta: {
      ...base.meta,
      storyRole: values.storyRole,
      tier: nextTier,
      modelTier: modelTierFor(nextTier),
    },
  };
  return RoleCardSchema.parse(card);
}
