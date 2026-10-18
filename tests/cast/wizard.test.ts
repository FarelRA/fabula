import { describe, expect, test } from "vitest";
import {
  DEFAULT_VALUES,
  newSceneSchema,
  sceneInputFrom,
  settingsFor,
  settingsFromInput,
  validateStep,
  valuesFromPreset,
} from "@/lib/cast/wizard";
import { presetById } from "@/lib/cast/presets";

/** Wizard/quick-start validation + preseed behaviour (Phase 4.1). */

const VALID = {
  ...DEFAULT_VALUES,
  premise: "A debt collector knocks on the wrong door in 1970s Saigon.",
  tone: { comedicGrim: -0.4, groundedFantastical: -0.6, romanceRivalry: 0.2 },
};

describe("newSceneSchema", () => {
  test("accepts a complete quick-start form", () => {
    const result = newSceneSchema.safeParse(VALID);
    expect(result.success).toBe(true);
  });

  test("rejects a too-short premise", () => {
    const result = newSceneSchema.safeParse({ ...VALID, premise: "Too short" });
    expect(result.success).toBe(false);
  });

  test("requires a character name when playing a role", () => {
    const result = newSceneSchema.safeParse({
      ...VALID,
      playAs: "role",
      yourName: "   ",
    });
    expect(result.success).toBe(false);
  });

  test("allows a role without a name when directing from the wings", () => {
    const result = newSceneSchema.safeParse({ ...VALID, playAs: "director" });
    expect(result.success).toBe(true);
  });
});

describe("validateStep", () => {
  test("premise step flags only premise problems", () => {
    const result = validateStep("premise", { ...DEFAULT_VALUES, premise: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.premise).toBeDefined();
      expect(result.errors.genre).toBeUndefined();
    }
  });

  test("world step ignores an empty premise from a later step", () => {
    const result = validateStep("world", { ...VALID, premise: "" });
    expect(result.success).toBe(true);
  });

  test("you step requires a name when playing a role", () => {
    const result = validateStep("you", {
      ...VALID,
      playAs: "role",
      yourName: "",
    });
    expect(result.success).toBe(false);
  });

  test("cast step enforces the 1–8 bounds", () => {
    expect(validateStep("cast", { ...VALID, castSize: 0 }).success).toBe(false);
    expect(validateStep("cast", { ...VALID, castSize: 9 }).success).toBe(false);
    expect(validateStep("cast", { ...VALID, castSize: 4 }).success).toBe(true);
  });
});

describe("valuesFromPreset", () => {
  test("applies premise, world, style, tone and cast size", () => {
    const noir = presetById("noir")!;
    const values = valuesFromPreset(noir);
    expect(values.premise).toBe(noir.premise);
    expect(values.genre).toBe(noir.genre);
    expect(values.settingEra).toBe(noir.settingEra);
    expect(values.presentationStyle).toBe(noir.presentationStyle);
    expect(values.castSize).toBe(noir.castSize);
    expect(values.tone).toEqual(noir.tone);
  });

  test("falls back to defaults without a preset", () => {
    expect(valuesFromPreset(undefined)).toEqual(DEFAULT_VALUES);
  });
});

describe("sceneInputFrom", () => {
  test("carries the template cast skeleton into the casting steer", () => {
    const noir = presetById("noir")!;
    const input = sceneInputFrom(VALID, "noir");
    expect(input.vibeSteer).toContain(noir.skeleton[0]!.hook);
    expect(input.title.length).toBeGreaterThan(0);
    expect(input.castSize).toBe(VALID.castSize);
  });

  test("includes the human role when requested", () => {
    const input = sceneInputFrom({
      ...VALID,
      playAs: "role",
      yourName: "Linh",
      yourPronouns: "she/her",
    });
    expect(input.youInScene).toEqual({ name: "Linh", pronouns: "she/her" });
    expect(input.boundaries.blocked).toEqual([]);
  });

  test("splits blocked-content text into a boundary list", () => {
    const input = sceneInputFrom({ ...VALID, blockedText: "graphic violence, torture" });
    expect(input.boundaries.blocked).toEqual(["graphic violence", "torture"]);
  });
});

describe("settings", () => {
  test("5+ roles switch to strict round-robin with single-beat bursts", () => {
    const settings = settingsFor({ ...VALID, castSize: 6 });
    expect(settings.turnRules.mode).toBe("roundRobin");
    expect(settings.turnRules.autoBurst).toBe(false);
    expect(settings.turnRules.burstMax).toBe(1);
  });

  test("≤4 roles keep reactive auto-burst", () => {
    const settings = settingsFor({ ...VALID, castSize: 3 });
    expect(settings.turnRules.mode).toBe("reactive");
    expect(settings.turnRules.autoBurst).toBe(true);
    expect(settings.turnRules.burstMax).toBe(2);
  });

  test("settingsFromInput mirrors the same policy", () => {
    const input = sceneInputFrom({ ...VALID, castSize: 7 });
    expect(settingsFromInput(input).turnRules.mode).toBe("roundRobin");
  });
});
