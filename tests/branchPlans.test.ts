import { describe, expect, test } from "vitest";
import { planEditFork, planPick, planRegenerate } from "../convex/domain/branchPlans";

describe("planPick, laws attach, fork-from-ghost", () => {
  test("extends the active branch when the parent is the active tip", () => {
    const plan = planPick({
      activeBranchId: "b_main",
      activeTipBeatId: "beat_7",
      candidateParentBeatId: "beat_7",
      candidateBranchId: "b_main",
    });
    expect(plan).toEqual({ kind: "extend", branchId: "b_main" });
  });

  test("forks from the parent when the candidate is a ghost", () => {
    const plan = planPick({
      activeBranchId: "b_main",
      activeTipBeatId: "beat_9",
      candidateParentBeatId: "beat_4",
      candidateBranchId: "b_main",
    });
    expect(plan).toEqual({
      kind: "fork",
      forkedFromBeatId: "beat_4",
      forkedFromBranchId: "b_main",
    });
  });

  test("forks when there is no active tip yet", () => {
    const plan = planPick({
      candidateParentBeatId: "beat_1",
      candidateBranchId: "b_main",
    });
    expect(plan.kind).toBe("fork");
  });
});

describe("planEditFork / planRegenerate, law fork-on-edit", () => {
  test("edit forks from the parent, never in place", () => {
    const plan = planEditFork({ id: "beat_5", parentBeatId: "beat_4", branchId: "b_main" });
    expect(plan).toEqual({ forkedFromBeatId: "beat_4", forkReason: "edit" });
  });

  test("editing the root forks with no parent", () => {
    const plan = planEditFork({ id: "beat_1", branchId: "b_main" });
    expect(plan.forkedFromBeatId).toBeUndefined();
  });

  test("regenerate has the same constraint-preserving shape", () => {
    const plan = planRegenerate({ id: "beat_5", parentBeatId: "beat_4", branchId: "b_main" });
    expect(plan).toEqual({ forkedFromBeatId: "beat_4", forkReason: "regenerate" });
  });
});
