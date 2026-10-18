/**
 * Pure planning core for the branch laws.
 *
 * Mutations own the DB side (creating rows, moving pointers, logging undo);
 * these functions own the *decisions*, so the laws are unit-testable without
 * a Convex runtime.
 */

export type BeatRef = {
  id: string;
  parentBeatId?: string;
  branchId: string;
};

export type PickPlan =
  | { kind: "extend"; branchId: string }
  | { kind: "fork"; forkedFromBeatId: string; forkedFromBranchId: string };

/**
 * attach, fork-from-ghost: picking a candidate appends it to the active branch when its parent
 * is the active tip; otherwise it forks a new branch from the parent.
 */
export function planPick(args: {
  activeBranchId?: string;
  activeTipBeatId?: string;
  candidateParentBeatId: string;
  candidateBranchId: string;
}): PickPlan {
  const atTip =
    args.activeTipBeatId !== undefined &&
    args.activeTipBeatId === args.candidateParentBeatId &&
    args.activeBranchId !== undefined;
  if (atTip) {
    return { kind: "extend", branchId: args.activeBranchId as string };
  }
  return {
    kind: "fork",
    forkedFromBeatId: args.candidateParentBeatId,
    forkedFromBranchId: args.candidateBranchId,
  };
}

export type ForkPlan = {
  forkedFromBeatId?: string;
  forkReason: "edit" | "regenerate";
};

/**
 * fork-on-edit: editing a beat always forks from its PARENT, the original beat (and
 * every other sibling) is preserved. Root edits fork with no parent.
 */
export function planEditFork(beat: BeatRef): ForkPlan {
  return { forkedFromBeatId: beat.parentBeatId, forkReason: "edit" };
}

/** fork-on-edit: regeneration has the same constraint-preserving shape as editing. */
export function planRegenerate(beat: BeatRef): ForkPlan {
  return { forkedFromBeatId: beat.parentBeatId, forkReason: "regenerate" };
}
