import { blankRoleCard } from "@/lib/cast/roles";
import {
  buildFixtureScene,
} from "@/lib/cast/fixtures";
import type { CastRole, SceneDraftInput } from "@/lib/cast/types";
import type { PlayBeat, PlayOption, PlayScene } from "@/lib/play/types";

const INPUT: SceneDraftInput = {
  title: "The Glass Harbor",
  premise: "A debt collector knocks on the wrong door in 1970s Saigon.",
  genre: "noir",
  settingEra: "Saigon, 1975",
  presentationStyle: "chat",
  playLanguage: "en",
  tone: { comedicGrim: -0.4, groundedFantastical: -0.6, romanceRivalry: 0.2 },
  boundaries: { allowed: [], blocked: [] },
  castSize: 3,
};

export function makeRoles(): CastRole[] {
  return Array.from({ length: 3 }, (_, index) => {
    const card = blankRoleCard(index, index === 0 ? "protagonist" : "support");
    card.identity = {
      ...card.identity,
      name: ["Linh", "Duc", "Mai"][index] ?? `Role ${index}`,
      monogram: ["L", "D", "M"][index] ?? "R",
    };
    card.meta = {
      ...card.meta,
      tier: index === 2 ? "supporting" : "spotlight",
      modelTier: index === 2 ? "standard" : "spotlight",
    };
    return {
      id: `role_${index}`,
      kind: "ai" as const,
      card,
      status: "active" as const,
      draftLocks: [],
    };
  });
}

export function makeBeat(
  overrides: Partial<PlayBeat> & Pick<PlayBeat, "id" | "seq">,
): PlayBeat {
  return {
    branchId: "branch_main",
    origin: "turn",
    status: "finished",
    isArtifact: false,
    isPinned: false,
    text: `Beat ${overrides.seq}`,
    createdAt: overrides.seq,
    ...overrides,
  };
}

export function makeOption(overrides: Partial<PlayOption> = {}): PlayOption {
  return {
    id: `option_${overrides.label ?? "one"}`,
    parentBeatId: "beat_1",
    parentSeq: 1,
    parentIsTip: true,
    optionIndex: 1,
    label: "Push inside",
    text: "She pushes the door and steps out of the rain.",
    strategy: "escalate",
    speakerRoleId: "role_0",
    ...overrides,
  };
}

export function makeScene(overrides: Partial<PlayScene> = {}): PlayScene {
  const base = buildFixtureScene(INPUT, "play_scene_test");
  const roles = overrides.roles ?? makeRoles();
  const opening = makeBeat({
    id: "beat_opening",
    seq: 1,
    origin: "opening",
    text: "Rain hadn't stopped for three days when she knocked.",
    speakerRoleId: roles[0]?.id,
  });
  return {
    ...base,
    status: "playing",
    activeTipBeatId: "beat_opening",
    roles,
    beats: [opening],
    pending: [],
    options: [],
    notes: [],
    ...overrides,
  };
}
