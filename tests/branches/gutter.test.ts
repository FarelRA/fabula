import { describe, expect, test } from "vitest";
import { buildGutterMarkers } from "@/lib/branches/gutter";
import { makeBranch, makeTreeBeat, makeTreeCandidate } from "./fixtures";

const main = makeBranch({ id: "branch_main", label: "Main", isActive: true, colorIndex: 0 });
const alt = makeBranch({
  id: "branch_alt",
  label: "Alternate · beat 2",
  forkedFromBeatId: "beat_2",
  parentBranchId: "branch_main",
  colorIndex: 3,
});

const beats = [
  makeTreeBeat({ id: "beat_1", seq: 1, branchId: "branch_main", origin: "opening" }),
  makeTreeBeat({ id: "beat_2", seq: 2, branchId: "branch_main" }),
  makeTreeBeat({ id: "beat_3", seq: 3, branchId: "branch_main" }),
  makeTreeBeat({ id: "beat_4", seq: 4, branchId: "branch_alt", parentBeatId: "beat_2", origin: "edit" }),
];

describe("gutter markers", () => {
  test("maps active-path beats proportionally to scene seq", () => {
    const markers = buildGutterMarkers({
      beats,
      branches: [main, alt],
      candidates: [],
      activeBeatIds: ["beat_1", "beat_2", "beat_3"],
      activeTipBeatId: "beat_3",
      activeBranchId: "branch_main",
      maxSeq: 4,
    });
    const pathMarkers = markers.filter((marker) => marker.onActivePath);
    expect(pathMarkers.map((marker) => marker.beatId)).toEqual([
      "beat_1",
      "beat_2",
      "beat_3",
    ]);
    expect(pathMarkers[0]?.fraction).toBe(0);
    expect(pathMarkers[1]?.fraction).toBeCloseTo(1 / 3);
    expect(pathMarkers[2]?.fraction).toBeCloseTo(2 / 3);
    expect(pathMarkers[2]?.isTip).toBe(true);
  });

  test("decision points become diamonds with candidate counts", () => {
    const markers = buildGutterMarkers({
      beats,
      branches: [main],
      candidates: [
        makeTreeCandidate({ id: "c1", parentBeatId: "beat_2" }),
        makeTreeCandidate({ id: "c2", parentBeatId: "beat_2" }),
        makeTreeCandidate({ id: "c3", parentBeatId: "beat_2" }),
        makeTreeCandidate({ id: "c4", parentBeatId: "beat_3", status: "picked" }),
      ],
      activeBeatIds: ["beat_1", "beat_2", "beat_3"],
      activeTipBeatId: "beat_3",
      activeBranchId: "branch_main",
      maxSeq: 4,
    });
    const decision = markers.find((marker) => marker.beatId === "beat_2");
    expect(decision?.kind).toBe("decision");
    expect(decision?.candidateCount).toBe(3);
    expect(markers.find((marker) => marker.beatId === "beat_3")?.kind).toBe("beat");
  });

  test("other branches appear as fork markers at their divergence point", () => {
    const markers = buildGutterMarkers({
      beats,
      branches: [main, alt],
      candidates: [],
      activeBeatIds: ["beat_1", "beat_2", "beat_3"],
      activeTipBeatId: "beat_3",
      activeBranchId: "branch_main",
      maxSeq: 4,
    });
    const fork = markers.find((marker) => marker.kind === "fork");
    expect(fork?.branchId).toBe("branch_alt");
    expect(fork?.label).toBe("Alternate · beat 2");
    expect(fork?.onActivePath).toBe(false);
    expect(fork?.fraction).toBeCloseTo(1 / 3); // parent beat 2
    expect(fork?.colorIndex).toBe(3);
  });

  test("single-beat and overflow safety", () => {
    const only = makeTreeBeat({ id: "solo", seq: 1, branchId: "branch_main" });
    const markers = buildGutterMarkers({
      beats: [only],
      branches: [main],
      candidates: [],
      activeBeatIds: ["solo"],
      activeBranchId: "branch_main",
      maxSeq: 1,
    });
    expect(markers).toHaveLength(1);
    expect(markers[0]?.fraction).toBe(0.5);
  });
});
