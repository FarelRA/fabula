import { describe, expect, test } from "vitest";
import {
  GENRE_PRESETS,
  presetById,
  skeletonVibe,
  toneSummary,
} from "@/lib/cast/presets";

/** Appendix A seeds: every template preseed is complete. */

describe("genre presets", () => {
  test("ships the six Appendix-A seeds with unique ids", () => {
    expect(GENRE_PRESETS).toHaveLength(6);
    expect(new Set(GENRE_PRESETS.map((preset) => preset.id)).size).toBe(6);
    expect(GENRE_PRESETS.map((preset) => preset.id)).toEqual([
      "noir",
      "court",
      "space",
      "campus",
      "tavern",
      "letters",
    ]);
  });

  test.each(GENRE_PRESETS)("$id is a complete seed", (preset) => {
    expect(preset.premise.length).toBeGreaterThan(30);
    expect(preset.genre.length).toBeGreaterThan(1);
    expect(preset.settingEra.length).toBeGreaterThan(2);
    expect(preset.castSize).toBeGreaterThanOrEqual(3);
    expect(preset.castSize).toBeLessThanOrEqual(4);
    expect(preset.skeleton.length).toBeGreaterThanOrEqual(3);
    expect(preset.starterNote.length).toBeGreaterThan(5);
    for (const value of Object.values(preset.tone)) {
      expect(value).toBeGreaterThanOrEqual(-1);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  test("presetById resolves and misses safely", () => {
    expect(presetById("noir")?.name).toBe("Noir interrogation");
    expect(presetById("nope")).toBeUndefined();
    expect(presetById(undefined)).toBeUndefined();
  });

  test("skeletonVibe carries every role hook into the casting steer", () => {
    const noir = presetById("noir");
    expect(noir).toBeDefined();
    const vibe = skeletonVibe(noir!);
    for (const role of noir!.skeleton) {
      expect(vibe).toContain(role.hook);
      expect(vibe).toContain(role.storyRole);
    }
  });

  test("toneSummary speaks in plain language", () => {
    expect(
      toneSummary({ comedicGrim: -0.6, groundedFantastical: -0.2, romanceRivalry: 0.6 }),
    ).toBe("Comedic · Grounded · Romance");
    expect(
      toneSummary({ comedicGrim: 0.6, groundedFantastical: 0.6, romanceRivalry: -0.6 }),
    ).toBe("Grim · Fantastical · Rivalry");
    expect(
      toneSummary({ comedicGrim: 0, groundedFantastical: 0, romanceRivalry: 0 }),
    ).toBe("Balanced · Balanced · Balanced");
  });
});
