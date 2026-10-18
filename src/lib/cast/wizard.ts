import { z } from "zod";
import {
  PresentationStyleSchema,
  ToneDialsSchema,
  type SceneSettings,
} from "@convex/shared/contracts";
import { deriveTitle } from "./roles";
import { presetById, skeletonVibe, type GenrePreset } from "./presets";
import type { SceneDraftInput } from "./types";

/**
 * New-scene forms. One schema powers quick start and
 * the guided wizard; step-specific field lists drive RHF validation per step.
 */

export const NEW_SCENE_STEPS = ["premise", "world", "you", "cast", "audition"] as const;
export type NewSceneStep = (typeof NEW_SCENE_STEPS)[number];

export const newSceneSchema = z
  .object({
    premise: z
      .string()
      .trim()
      .min(12, "Give us at least a full sentence (12+ characters).")
      .max(600, "Keep the premise under 600 characters."),
    genre: z.string().trim().min(2, "Name a genre.").max(60),
    settingEra: z.string().trim().min(2, "Set the era or place.").max(120),
    presentationStyle: PresentationStyleSchema,
    playLanguage: z.string().trim().min(2, "Add a language tag (e.g. en).").max(24),
    tone: ToneDialsSchema,
    blockedText: z.string().max(500, "Keep boundaries short."),
    playAs: z.enum(["director", "role"]),
    yourName: z.string().trim().max(40).optional(),
    yourPronouns: z.string().trim().max(40).optional(),
    castSize: z.number().int().min(1).max(8),
  })
  .superRefine((values, ctx) => {
    if (values.playAs === "role" && !values.yourName?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["yourName"],
        message: "Give your role a name.",
      });
    }
  });

export type NewSceneValues = z.infer<typeof newSceneSchema>;

export const STEP_FIELDS: Record<
  Exclude<NewSceneStep, "audition">,
  Array<keyof NewSceneValues>
> = {
  premise: ["premise"],
  world: ["genre", "settingEra", "presentationStyle", "playLanguage", "tone", "blockedText"],
  you: ["playAs", "yourName", "yourPronouns"],
  cast: ["castSize"],
};

export const TONE_DIALS = [
  { key: "comedicGrim", left: "Comedic", right: "Grim" },
  { key: "groundedFantastical", left: "Grounded", right: "Fantastical" },
  { key: "romanceRivalry", left: "Rivalry", right: "Romance" },
] as const;

export const DEFAULT_VALUES: NewSceneValues = {
  premise: "",
  genre: "drama",
  settingEra: "present day",
  presentationStyle: "chat",
  playLanguage: "en",
  tone: { comedicGrim: 0, groundedFantastical: 0, romanceRivalry: 0 },
  blockedText: "",
  playAs: "director",
  yourName: "",
  yourPronouns: "",
  castSize: 3,
};

export function valuesFromPreset(
  preset: GenrePreset | undefined,
): NewSceneValues {
  if (!preset) return { ...DEFAULT_VALUES, tone: { ...DEFAULT_VALUES.tone } };
  return {
    ...DEFAULT_VALUES,
    premise: preset.premise,
    genre: preset.genre,
    settingEra: preset.settingEra,
    presentationStyle: preset.presentationStyle,
    tone: { ...preset.tone },
    castSize: preset.castSize,
  };
}

export const PRESET_IDS = ["noir", "court", "space", "campus", "tavern", "letters"] as const;
export const newSceneStepSchema = z.enum(NEW_SCENE_STEPS);

export function splitList(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function settingsFor(values: NewSceneValues): SceneSettings {
  const strictTurnTaking = values.castSize >= 5;
  return {
    genre: values.genre,
    settingEra: values.settingEra,
    presentationStyle: values.presentationStyle,
    playLanguage: values.playLanguage,
    tone: values.tone,
    boundaries: {
      allowed: [],
      blocked: splitList(values.blockedText),
    },
    turnRules: {
      mode: strictTurnTaking ? "roundRobin" : "reactive",
      autoBurst: !strictTurnTaking,
      burstMax: strictTurnTaking ? 1 : 2,
      abortedKeepsPartial: true,
    },
    branchFrequency: "key",
    optionsDefaultCount: 3,
    contextBeatsK: 30,
    summaryEveryN: 6,
    lengthTarget: "medium",
    budget: {},
  };
}

export function sceneInputFrom(values: NewSceneValues, templateId?: string): SceneDraftInput {
  const preset = presetById(templateId);
  const youInScene =
    values.playAs === "role" && values.yourName?.trim()
      ? {
          name: values.yourName.trim(),
          pronouns: values.yourPronouns?.trim() || undefined,
        }
      : undefined;
  return {
    title: deriveTitle(values.premise),
    premise: values.premise.trim(),
    genre: values.genre.trim(),
    settingEra: values.settingEra.trim(),
    presentationStyle: values.presentationStyle,
    playLanguage: values.playLanguage.trim(),
    tone: { ...values.tone },
    boundaries: {
      allowed: [],
      blocked: splitList(values.blockedText),
    },
    castSize: values.castSize,
    youInScene,
    vibeSteer: preset ? skeletonVibe(preset) : undefined,
  };
}

export function settingsFromInput(input: SceneDraftInput): SceneSettings {
  return {
    genre: input.genre,
    settingEra: input.settingEra,
    presentationStyle: input.presentationStyle,
    playLanguage: input.playLanguage,
    tone: input.tone,
    boundaries: input.boundaries,
    turnRules: {
      mode: input.castSize >= 5 ? "roundRobin" : "reactive",
      autoBurst: input.castSize < 5,
      burstMax: input.castSize >= 5 ? 1 : 2,
      abortedKeepsPartial: true,
    },
    branchFrequency: "key",
    optionsDefaultCount: 3,
    contextBeatsK: 30,
    summaryEveryN: 6,
    lengthTarget: "medium",
    budget: {},
  };
}

/** Validation helper for the wizard's Continue button (pure, CI-tested). */
export function validateStep(
  step: Exclude<NewSceneStep, "audition">,
  values: NewSceneValues,
): { success: true } | { success: false; errors: Partial<Record<keyof NewSceneValues, string>> } {
  const result = newSceneSchema.safeParse(values);
  if (result.success) return { success: true };
  const errors: Partial<Record<keyof NewSceneValues, string>> = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && STEP_FIELDS[step].includes(key as keyof NewSceneValues)) {
      if (!errors[key as keyof NewSceneValues]) {
        errors[key as keyof NewSceneValues] = issue.message;
      }
    }
  }
  return Object.keys(errors).length === 0
    ? { success: true }
    : { success: false, errors };
}
