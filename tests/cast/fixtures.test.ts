import { describe, expect, test } from "vitest";
import {
  buildFixtureScene,
  fixtureSampleLines,
  generateFixtureCast,
  generateFixtureOpening,
  regenerateFixtureCast,
  regenerateFixtureField,
} from "@/lib/cast/fixtures";
import type { SceneDraftInput } from "@/lib/cast/types";
import { tierDefaultsForSize } from "@/lib/cast/tierPolicy";

const INPUT: SceneDraftInput = {
  title: "The Glass Harbor",
  premise: "A debt collector knocks on the wrong door in 1970s Saigon.",
  genre: "noir",
  settingEra: "Saigon, 1975",
  presentationStyle: "novel",
  playLanguage: "en",
  tone: { comedicGrim: -0.4, groundedFantastical: -0.6, romanceRivalry: 0.2 },
  boundaries: { allowed: [], blocked: ["graphic violence"] },
  castSize: 4,
};

describe("generateFixtureCast", () => {
  test("is deterministic for the same input and variant", () => {
    const first = generateFixtureCast({ ...INPUT, variant: 0 });
    const second = generateFixtureCast({ ...INPUT, variant: 0 });
    expect(first).toEqual(second);
    const third = generateFixtureCast({ ...INPUT, variant: 1 });
    expect(third.map((role) => role.card.identity.name)).not.toEqual(
      first.map((role) => role.card.identity.name),
    );
  });

  test("assigns tiers according to the sizing policy", () => {
    const cast = generateFixtureCast({ ...INPUT, castSize: 7 });
    expect(cast.map((role) => role.card.meta.tier)).toEqual(tierDefaultsForSize(7));
    for (const role of cast) {
      expect(role.card.meta.modelTier).toBe(
        role.card.meta.tier === "spotlight"
          ? "spotlight"
          : role.card.meta.tier === "supporting"
            ? "standard"
            : "cheap",
      );
    }
  });

  test("keeps the relationship graph connected with alliance + friction", () => {
    const cast = generateFixtureCast({ ...INPUT, castSize: 4 });
    const ids = new Set(cast.map((role) => role.id));
    for (const role of cast) {
      expect(role.card.relations.length).toBeGreaterThan(0);
      for (const relation of role.card.relations) {
        expect(ids.has(relation.toRoleId)).toBe(true);
      }
    }
    const dynamics = cast.flatMap((role) =>
      role.card.relations.map((relation) => relation.dynamic),
    );
    expect(dynamics).toContain("ally");
    expect(dynamics).toContain("rival");
  });

  test("adds the human role last when you-in-scene is chosen", () => {
    const cast = generateFixtureCast({
      ...INPUT,
      castSize: 3,
      youInScene: { name: "Linh", pronouns: "she/her" },
    });
    expect(cast).toHaveLength(4);
    const human = cast.at(-1);
    expect(human?.kind).toBe("human");
    expect(human?.card.identity.name).toBe("Linh");
    expect(human?.card.identity.pronouns).toBe("she/her");
  });
});

describe("fixture scene + opening", () => {
  test("builds a draft scene with settings from the input", () => {
    const scene = buildFixtureScene(INPUT, "fixture_scene_test");
    expect(scene.id).toBe("fixture_scene_test");
    expect(scene.status).toBe("draft");
    expect(scene.settings.presentationStyle).toBe("novel");
    expect(scene.roles).toHaveLength(4);
    expect(scene.beats).toEqual([]);
  });

  test("opening is deterministic per variant, varied across rerolls, and cast to style", () => {
    const scene = buildFixtureScene(INPUT, "fixture_scene_test");
    const first = generateFixtureOpening(scene, 0);
    const same = generateFixtureOpening(scene, 0);
    const reroll = generateFixtureOpening(scene, 1);
    expect(first.text).toBe(same.text);
    expect(reroll.text).not.toBe(first.text);
    expect(first.speakerRoleId).toBe(
      scene.roles.find((role) => role.card.meta.tier === "spotlight")?.id,
    );
    expect(first.text.length).toBeGreaterThan(60);
  });

  test("script style opens with an uppercase name and stage direction", () => {
    const scene = buildFixtureScene(
      { ...INPUT, presentationStyle: "script" },
      "fixture_scene_script",
    );
    const opening = generateFixtureOpening(scene, 0);
    const speaker = scene.roles.find((role) => role.id === opening.speakerRoleId);
    expect(opening.text.startsWith(speaker!.card.identity.name.toLocaleUpperCase())).toBe(true);
    expect(opening.text).toContain("(");
  });
});

describe("fixture regeneration + samples", () => {
  test("cast regen respects locked fields byte-for-byte", () => {
    const scene = buildFixtureScene(INPUT, "fixture_scene_regen");
    const first = scene.roles[0]!;
    const lockedHook = first.card.hook;
    const lockedVoice = first.card.voice;
    const locked = {
      ...first,
      draftLocks: ["hook", "voice"],
    };
    const roles = regenerateFixtureCast(
      { ...scene, roles: [locked, ...scene.roles.slice(1)] },
      "make everyone younger",
      2,
    );
    expect(roles[0]?.card.hook).toBe(lockedHook);
    expect(roles[0]?.card.voice).toEqual(lockedVoice);
    expect(roles[0]?.card.meta.tier).toBeDefined();
  });

  test("cast regen leaves off-stage and human roles untouched", () => {
    const scene = buildFixtureScene(
      { ...INPUT, castSize: 3, youInScene: { name: "Linh" } },
      "fixture_scene_preserve",
    );
    const offstage = scene.roles[1]!;
    const human = scene.roles.find((role) => role.kind === "human")!;
    const prepared = {
      ...scene,
      roles: scene.roles.map((role) =>
        role.id === offstage.id ? { ...role, status: "offstage" as const } : role,
      ),
    };
    const roles = regenerateFixtureCast(prepared, "younger cast", 2);
    expect(roles.find((role) => role.id === offstage.id)).toEqual(
      prepared.roles.find((role) => role.id === offstage.id),
    );
    expect(roles.find((role) => role.id === human.id)).toEqual(
      prepared.roles.find((role) => role.id === human.id),
    );
    expect(roles.find((role) => role.id === scene.roles[0]!.id)?.card.hook).not.toBe(
      undefined,
    );
  });

  test("field regen changes the requested group and is salt-dependent", () => {
    const scene = buildFixtureScene(INPUT, "fixture_scene_field");
    const role = scene.roles[0]!;
    const first = regenerateFixtureField(role, "hook", 1);
    const second = regenerateFixtureField(role, "hook", 2);
    expect(first.hook).not.toBe(role.card.hook);
    expect(first.psychology).toEqual(role.card.psychology);
    expect(second.hook).not.toBe(first.hook);
  });

  test("sample lines are cached unless force is set", () => {
    const scene = buildFixtureScene(INPUT, "fixture_scene_sample");
    const role = scene.roles[0]!;
    const cached = fixtureSampleLines(role, false, 1);
    expect(cached).toEqual(role.card.voice.sampleLines.slice(0, 3));
    const forced = fixtureSampleLines(role, true, 1);
    expect(forced).toHaveLength(2);
    expect(forced[1]).not.toBe(cached[1]);
  });
});
