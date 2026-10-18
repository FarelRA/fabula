import {
  buildFixtureScene,
  generateFixtureOpening,
} from "@/lib/cast/fixtures";
import type { CastBusy, CastScene, SceneDraftInput } from "@/lib/cast/types";

export const EMPTY_BUSY: CastBusy = {
  casting: false,
  castRegen: false,
  resize: false,
  role: null,
  field: null,
  sample: null,
  opening: false,
};

export function makeInput(overrides: Partial<SceneDraftInput> = {}): SceneDraftInput {
  return {
    title: "The Glass Harbor",
    premise: "A debt collector knocks on the wrong door in 1970s Saigon.",
    genre: "noir",
    settingEra: "Saigon, 1975",
    presentationStyle: "novel",
    playLanguage: "en",
    tone: { comedicGrim: -0.4, groundedFantastical: -0.6, romanceRivalry: 0.2 },
    boundaries: { allowed: [], blocked: [] },
    castSize: 3,
    ...overrides,
  };
}

export function makeFixtureScene(
  overrides: Partial<SceneDraftInput> = {},
  sceneId = "fixture_scene_test",
): CastScene {
  const scene = buildFixtureScene(makeInput(overrides), sceneId);
  return { ...scene, openingDraft: generateFixtureOpening(scene, 0) };
}
