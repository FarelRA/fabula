import type { BranchInfo, TreeBeat, TreeCandidate } from "./types";

/**
 * Branch gutter/minimap model (PLAN Phase 6.1). The gutter is a rail beside
 * the thread: one marker per active-path beat (diamonds at decision points)
 * plus fork markers where other branches diverge. Positions are proportional
 * to scene seq, so the rail mirrors the full story tree even while the thread
 * is virtualized.
 */

export type GutterMarker = {
  key: string;
  kind: "beat" | "decision" | "fork";
  beatId?: string;
  branchId: string;
  label: string;
  colorIndex: number;
  /** 0..1 vertical position across the scene's seq range. */
  fraction: number;
  isTip: boolean;
  isPinned: boolean;
  isFailed: boolean;
  candidateCount: number;
  onActivePath: boolean;
};

export function buildGutterMarkers(args: {
  beats: readonly TreeBeat[];
  branches: readonly BranchInfo[];
  candidates: readonly TreeCandidate[];
  activeBeatIds: readonly string[];
  activeTipBeatId?: string;
  activeBranchId?: string;
  maxSeq: number;
}): GutterMarker[] {
  const {
    beats,
    branches,
    candidates,
    activeBeatIds,
    activeTipBeatId,
    activeBranchId,
    maxSeq,
  } = args;
  const active = new Set(activeBeatIds);
  const pathBeats = beats
    .filter((beat) => active.has(beat.id))
    .sort((a, b) => a.seq - b.seq);
  const offered = new Map<string, number>();
  for (const candidate of candidates) {
    if (candidate.status !== "offered") continue;
    offered.set(candidate.parentBeatId, (offered.get(candidate.parentBeatId) ?? 0) + 1);
  }
  const fractionFor = (seq: number): number => {
    if (maxSeq <= 1) return 0.5;
    return Math.min(1, Math.max(0, (seq - 1) / (maxSeq - 1)));
  };

  const markers: GutterMarker[] = [];
  for (const beat of pathBeats) {
    const candidateCount = offered.get(beat.id) ?? 0;
    markers.push({
      key: `beat:${beat.id}`,
      kind: candidateCount > 0 ? "decision" : "beat",
      beatId: beat.id,
      branchId: beat.branchId,
      label: `Beat ${beat.seq}`,
      colorIndex: branchColor(branches, beat.branchId),
      fraction: fractionFor(beat.seq),
      isTip: beat.id === activeTipBeatId,
      isPinned: beat.isPinned,
      isFailed: beat.status === "failed",
      candidateCount,
      onActivePath: true,
    });
  }

  const pathIds = new Set(pathBeats.map((beat) => beat.id));
  for (const branch of branches) {
    if (branch.id === activeBranchId) continue;
    if (!branch.forkedFromBeatId || !pathIds.has(branch.forkedFromBeatId)) continue;
    const parent = beats.find((beat) => beat.id === branch.forkedFromBeatId);
    if (!parent) continue;
    markers.push({
      key: `fork:${branch.id}`,
      kind: "fork",
      branchId: branch.id,
      label: branch.label,
      colorIndex: branch.colorIndex,
      fraction: fractionFor(parent.seq),
      isTip: false,
      isPinned: false,
      isFailed: false,
      candidateCount: 0,
      onActivePath: false,
    });
  }

  const order: Record<GutterMarker["kind"], number> = { beat: 0, decision: 1, fork: 2 };
  return markers.sort(
    (a, b) =>
      a.fraction - b.fraction ||
      order[a.kind] - order[b.kind] ||
      a.key.localeCompare(b.key),
  );
}

function branchColor(branches: readonly BranchInfo[], branchId: string): number {
  return branches.find((branch) => branch.id === branchId)?.colorIndex ?? 0;
}
