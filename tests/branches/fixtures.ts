import type {
  BranchInfo,
  StoryTree,
  TreeBeat,
  TreeCandidate,
} from "@/lib/branches/types";

export function makeTreeBeat(
  overrides: Partial<TreeBeat> & Pick<TreeBeat, "id" | "seq" | "branchId">,
): TreeBeat {
  return {
    depth: overrides.seq - 1,
    origin: "turn",
    status: "finished",
    isArtifact: false,
    isPinned: false,
    textPreview: `Beat ${overrides.seq}`,
    textChars: 8,
    createdAt: overrides.seq,
    ...overrides,
  };
}

export function makeBranch(
  overrides: Partial<BranchInfo> & Pick<BranchInfo, "id">,
): BranchInfo {
  return {
    label: overrides.id,
    colorIndex: 0,
    beatCount: 0,
    isActive: false,
    createdAt: 1,
    ...overrides,
  };
}

export function makeTreeCandidate(
  overrides: Partial<TreeCandidate> & Pick<TreeCandidate, "id" | "parentBeatId">,
): TreeCandidate {
  return {
    label: "Push inside",
    optionIndex: 1,
    status: "offered",
    ...overrides,
  };
}

export function makeStoryTree(overrides: Partial<StoryTree> = {}): StoryTree {
  const branches = overrides.branches ?? [
    makeBranch({ id: "branch_main", label: "Main", isActive: true, tipBeatId: "beat_3" }),
    makeBranch({
      id: "branch_alt",
      label: "Alternate · beat 2",
      forkedFromBeatId: "beat_2",
      parentBranchId: "branch_main",
      colorIndex: 3,
      tipBeatId: "beat_4",
    }),
  ];
  const beats =
    overrides.beats ??
    [
      makeTreeBeat({ id: "beat_1", seq: 1, branchId: "branch_main", origin: "opening" }),
      makeTreeBeat({ id: "beat_2", seq: 2, branchId: "branch_main", parentBeatId: "beat_1" }),
      makeTreeBeat({
        id: "beat_3",
        seq: 3,
        branchId: "branch_main",
        parentBeatId: "beat_2",
        origin: "option",
      }),
      makeTreeBeat({
        id: "beat_4",
        seq: 4,
        branchId: "branch_alt",
        parentBeatId: "beat_2",
        origin: "edit",
      }),
    ];
  return {
    branches,
    beats,
    candidates: overrides.candidates ?? [
      makeTreeCandidate({ id: "c1", parentBeatId: "beat_2" }),
      makeTreeCandidate({ id: "c2", parentBeatId: "beat_2" }),
    ],
    activeBranchId: overrides.activeBranchId ?? "branch_main",
    activeTipBeatId: overrides.activeTipBeatId ?? "beat_3",
    activeBeatIds: overrides.activeBeatIds ?? ["beat_1", "beat_2", "beat_3"],
    ...overrides,
  };
}
