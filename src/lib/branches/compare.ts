/**
 * Two-branch alignment for the compare view (PLAN Phase 6.4 / H2 11.1).
 * Beats align by `depth` along each branch; rows flag missing beats or text
 * divergence. Read-only by construction: this module never produces edits.
 */

export type CompareBeat = {
  id: string;
  seq: number;
  depth: number;
  text: string;
  speakerName: string;
  origin: string;
  status: string;
};

export type CompareRow = {
  key: string;
  depth: number;
  left?: CompareBeat;
  right?: CompareBeat;
  divergence: boolean;
};

export function alignBranches(
  left: readonly CompareBeat[],
  right: readonly CompareBeat[],
): CompareRow[] {
  const byDepth = (beats: readonly CompareBeat[]) => {
    const map = new Map<number, CompareBeat>();
    for (const beat of beats) {
      if (!map.has(beat.depth)) map.set(beat.depth, beat);
    }
    return map;
  };
  const leftByDepth = byDepth(left);
  const rightByDepth = byDepth(right);
  const depths = [...new Set([...leftByDepth.keys(), ...rightByDepth.keys()])].sort(
    (a, b) => a - b,
  );
  return depths.map((depth) => {
    const leftBeat = leftByDepth.get(depth);
    const rightBeat = rightByDepth.get(depth);
    return {
      key: `depth:${depth}`,
      depth,
      left: leftBeat,
      right: rightBeat,
      divergence:
        !leftBeat !== !rightBeat || leftBeat?.text !== rightBeat?.text,
    };
  });
}
