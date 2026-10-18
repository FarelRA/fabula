/**
 * Lightweight invariant assertions. Called from mutations after
 * pointer changes; thrown errors roll the whole mutation back (Convex
 * transactions are atomic), so a violated invariant can never persist.
 */

export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Invariant violated: ${message}`);
  }
}

/** Law: scenes.activeTipBeatId and activeBranchId are always consistent. */
export function assertPointersConsistent(args: {
  activeBranchId?: string;
  activeTipBeatId?: string;
  tipBranchId?: string;
}): void {
  const { activeBranchId, activeTipBeatId, tipBranchId } = args;
  if (activeTipBeatId === undefined) return; // pre-opener state
  invariant(activeBranchId !== undefined, "active tip set but no active branch");
  if (tipBranchId !== undefined) {
    invariant(
      tipBranchId === activeBranchId,
      "active tip belongs to a different branch than activeBranchId",
    );
  }
}

/** Law: at most one generation run may be running per scene. */
export function assertSingleActiveRun(statuses: string[]): void {
  const running = statuses.filter((s) => s === "running").length;
  invariant(running <= 1, `expected ≤1 running generation run, found ${running}`);
}

/** Law: beats.seq strictly increases per scene. */
export function assertSeqAdvanced(previousSeq: number, nextSeq: number): void {
  invariant(nextSeq > previousSeq, `seq must advance: ${previousSeq} -> ${nextSeq}`);
}
