import { describe, expect, test } from "vitest";
import {
  buildChain,
  filterFactsAlongPath,
  filterSummariesAlongPath,
  pathSets,
  type BeatLike,
  type FactLike,
} from "../convex/lib/path";

/**
 * Pure path-projection tests. The DB-backed wrapper is covered by the
 * convex-test leak suite in tests/convex/projectionLeak.test.ts.
 */

const beats: BeatLike[] = [
  { _id: "r", seq: 1, branchId: "b_main" },
  { _id: "a1", parentBeatId: "r", seq: 2, branchId: "b_main" },
  { _id: "a2", parentBeatId: "a1", seq: 3, branchId: "b_main" },
  { _id: "b1", parentBeatId: "r", seq: 4, branchId: "b_fork" },
];

describe("buildChain", () => {
  test("walks from tip to root, oldest first", () => {
    const chain = buildChain(beats, "a2");
    expect(chain.map((b) => b._id)).toEqual(["r", "a1", "a2"]);
  });

  test("an empty tip yields an empty chain", () => {
    expect(buildChain(beats, undefined)).toEqual([]);
  });

  test("throws on cycles", () => {
    const cyclic: BeatLike[] = [
      { _id: "x", parentBeatId: "y", seq: 1, branchId: "b" },
      { _id: "y", parentBeatId: "x", seq: 2, branchId: "b" },
    ];
    expect(() => buildChain(cyclic, "x")).toThrow(/cycle/i);
  });

  test("throws on dangling parents", () => {
    expect(() => buildChain([{ _id: "x", parentBeatId: "missing", seq: 1, branchId: "b" }], "x")).toThrow();
  });
});

describe("pathSets", () => {
  test("collects ids and seqs", () => {
    const { ids, seqs } = pathSets(buildChain(beats, "b1"));
    expect(ids).toEqual(new Set(["r", "b1"]));
    expect(seqs).toEqual(new Set([1, 4]));
  });
});

describe("filterFactsAlongPath", () => {
  const facts: FactLike[] = [
    { nodeId: "a1", isPinned: false, status: "active" }, // on path A
    { nodeId: "b1", isPinned: false, status: "active" }, // on path B only
    { nodeId: "b1", isPinned: true, status: "active" }, // global canon override
    { nodeId: "r", isPinned: false, status: "muted" }, // muted
  ];

  test("keeps only path facts, plus pinned global overrides; never muted", () => {
    const { ids } = pathSets(buildChain(beats, "a2"));
    const kept = filterFactsAlongPath(facts, ids);
    expect(kept).toEqual([
      { nodeId: "a1", isPinned: false, status: "active" },
      { nodeId: "b1", isPinned: true, status: "active" },
    ]);
  });

  test("leak check: no other-branch fact on the active path", () => {
    const { ids } = pathSets(buildChain(beats, "a2"));
    const kept = filterFactsAlongPath(facts, ids);
    const unpinnedFromB = kept.filter((f) => f.nodeId === "b1" && !f.isPinned);
    expect(unpinnedFromB).toHaveLength(0);
  });
});

describe("filterSummariesAlongPath", () => {
  test("keeps summaries whose end beat is on the path", () => {
    const { seqs } = pathSets(buildChain(beats, "a2"));
    const kept = filterSummariesAlongPath(
      [{ coveredThroughSeq: 1 }, { coveredThroughSeq: 2 }, { coveredThroughSeq: 4 }],
      seqs,
    );
    expect(kept).toEqual([{ coveredThroughSeq: 1 }, { coveredThroughSeq: 2 }]);
  });
});
