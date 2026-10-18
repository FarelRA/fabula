import { describe, expect, test } from "vitest";
import {
  buildMapGraph,
  layoutMapGraph,
  MAP_NODE_HEIGHT,
  MAP_NODE_WIDTH,
} from "@/lib/branches/graph";
import { makeBranch, makeTreeBeat, makeTreeCandidate } from "./fixtures";

const main = makeBranch({ id: "branch_main", label: "Main", isActive: true });
const alt = makeBranch({
  id: "branch_alt",
  label: "Alternate · beat 2",
  forkedFromBeatId: "beat_2",
  colorIndex: 3,
});

const beats = [
  makeTreeBeat({ id: "beat_1", seq: 1, branchId: "branch_main", origin: "opening" }),
  makeTreeBeat({
    id: "beat_2",
    seq: 2,
    branchId: "branch_main",
    parentBeatId: "beat_1",
    speakerRoleId: "role_0",
  }),
  makeTreeBeat({
    id: "beat_3",
    seq: 3,
    branchId: "branch_main",
    parentBeatId: "beat_2",
  }),
  makeTreeBeat({
    id: "beat_4",
    seq: 4,
    branchId: "branch_alt",
    parentBeatId: "beat_2",
    origin: "edit",
    speakerRoleId: "role_0",
  }),
];

const names: Record<string, string> = { role_0: "Linh" };
const speakerName = (roleId?: string) => (roleId ? (names[roleId] ?? "Role") : "Narration");

describe("story map graph", () => {
  test("builds branch-colored nodes and parent edges with active flags", () => {
    const graph = buildMapGraph({
      beats,
      branches: [main, alt],
      candidates: [
        makeTreeCandidate({ id: "c1", parentBeatId: "beat_2" }),
        makeTreeCandidate({ id: "c2", parentBeatId: "beat_2" }),
        makeTreeCandidate({ id: "c3", parentBeatId: "beat_4", status: "picked" }),
      ],
      activeBeatIds: ["beat_1", "beat_2", "beat_4"],
      activeTipBeatId: "beat_4",
      speakerName,
    });

    expect(graph.nodes).toHaveLength(4);
    const beat4 = graph.nodes.find((node) => node.id === "beat_4");
    expect(beat4?.isActive).toBe(true);
    expect(beat4?.isTip).toBe(true);
    expect(beat4?.branchLabel).toBe("Alternate · beat 2");
    expect(beat4?.colorIndex).toBe(3);
    expect(beat4?.speakerName).toBe("Linh");
    expect(graph.nodes.find((node) => node.id === "beat_3")?.isActive).toBe(false);
    expect(graph.nodes.find((node) => node.id === "beat_1")?.isRoot).toBe(true);
    expect(graph.nodes.find((node) => node.id === "beat_2")?.candidateCount).toBe(2);

    expect(graph.edges).toHaveLength(3);
    const activeEdge = graph.edges.find((edge) => edge.target === "beat_4");
    expect(activeEdge?.source).toBe("beat_2");
    expect(activeEdge?.isActive).toBe(true);
    expect(graph.edges.find((edge) => edge.target === "beat_3")?.isActive).toBe(false);
  });

  test("lays nodes out with dagre: roots above children, sizes respected", () => {
    const graph = buildMapGraph({
      beats,
      branches: [main, alt],
      candidates: [],
      activeBeatIds: ["beat_1", "beat_2", "beat_3"],
      activeTipBeatId: "beat_3",
      speakerName,
    });
    const laid = layoutMapGraph(graph.nodes, graph.edges);
    const byId = new Map(laid.map((node) => [node.id, node]));
    const root = byId.get("beat_1");
    const child = byId.get("beat_2");
    expect(root && child && child.position.y).toBeGreaterThan(
      (root?.position.y ?? 0) + MAP_NODE_HEIGHT,
    );
    for (const node of laid) {
      expect(Number.isFinite(node.position.x)).toBe(true);
      expect(Number.isFinite(node.position.y)).toBe(true);
    }
    const leftRight = layoutMapGraph(graph.nodes, graph.edges, "LR");
    const lrRoot = leftRight.find((node) => node.id === "beat_1");
    const lrChild = leftRight.find((node) => node.id === "beat_2");
    expect(lrChild && lrRoot && lrChild.position.x).toBeGreaterThan(
      (lrRoot?.position.x ?? 0) + MAP_NODE_WIDTH,
    );
  });
});
