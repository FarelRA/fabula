import dagre from "@dagrejs/dagre";
import type { BranchInfo, TreeBeat, TreeCandidate } from "./types";

/**
 * Story-map graph model. Nodes are beats (colored by their
 * branch), edges are parent→child canon links; the active path and the active
 * tip are flagged for highlighting. Layout is delegated to dagre (maintained
 * layout engine, never hand-rolled). This module is imported only from the
 * lazy map chunk so dagre never enters the play route's initial JS.
 */

export const MAP_NODE_WIDTH = 184;
export const MAP_NODE_HEIGHT = 56;

export type MapNodeData = {
  id: string;
  branchId: string;
  branchLabel: string;
  colorIndex: number;
  seq: number;
  depth: number;
  speakerRoleId?: string;
  speakerName: string;
  origin: string;
  status: string;
  isArtifact: boolean;
  isPinned: boolean;
  isActive: boolean;
  isTip: boolean;
  isRoot: boolean;
  candidateCount: number;
  textPreview: string;
  textChars: number;
  createdAt: number;
};

export type MapEdgeData = {
  id: string;
  source: string;
  target: string;
  branchId: string;
  isActive: boolean;
};

export function buildMapGraph(args: {
  beats: readonly TreeBeat[];
  branches: readonly BranchInfo[];
  candidates: readonly TreeCandidate[];
  activeBeatIds: readonly string[];
  activeTipBeatId?: string;
  speakerName: (roleId?: string) => string;
}): { nodes: MapNodeData[]; edges: MapEdgeData[] } {
  const active = new Set(args.activeBeatIds);
  const branchById = new Map(args.branches.map((branch) => [branch.id, branch]));
  const optionCounts = new Map<string, number>();
  for (const candidate of args.candidates) {
    if (candidate.status === "dismissed") continue;
    optionCounts.set(
      candidate.parentBeatId,
      (optionCounts.get(candidate.parentBeatId) ?? 0) + 1,
    );
  }

  const nodes: MapNodeData[] = args.beats
    .slice()
    .sort((a, b) => a.seq - b.seq)
    .map((beat) => {
      const branch = branchById.get(beat.branchId);
      return {
        id: beat.id,
        branchId: beat.branchId,
        branchLabel: branch?.label ?? "Branch",
        colorIndex: branch?.colorIndex ?? 0,
        seq: beat.seq,
        depth: beat.depth,
        speakerRoleId: beat.speakerRoleId,
        speakerName: args.speakerName(beat.speakerRoleId),
        origin: beat.origin,
        status: beat.status,
        isArtifact: beat.isArtifact,
        isPinned: beat.isPinned,
        isActive: active.has(beat.id),
        isTip: beat.id === args.activeTipBeatId,
        isRoot: !beat.parentBeatId,
        candidateCount: optionCounts.get(beat.id) ?? 0,
        textPreview: beat.textPreview,
        textChars: beat.textChars,
        createdAt: beat.createdAt,
      };
    });

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges: MapEdgeData[] = args.beats
    .filter((beat) => beat.parentBeatId && nodeIds.has(beat.parentBeatId))
    .map((beat) => ({
      id: `e:${beat.parentBeatId}->${beat.id}`,
      source: beat.parentBeatId as string,
      target: beat.id,
      branchId: beat.branchId,
      isActive: active.has(beat.id) && active.has(beat.parentBeatId as string),
    }));

  return { nodes, edges };
}

export function layoutMapGraph(
  nodes: readonly MapNodeData[],
  edges: readonly MapEdgeData[],
  direction: "TB" | "LR" = "TB",
): Array<MapNodeData & { position: { x: number; y: number } }> {
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: direction, nodesep: 28, ranksep: 56 });
  graph.setDefaultEdgeLabel(() => ({}));
  for (const node of nodes) {
    graph.setNode(node.id, { width: MAP_NODE_WIDTH, height: MAP_NODE_HEIGHT });
  }
  for (const edge of edges) {
    graph.setEdge(edge.source, edge.target);
  }
  dagre.layout(graph);
  return nodes.map((node) => {
    const laid = graph.node(node.id) as { x: number; y: number } | undefined;
    return {
      ...node,
      position: {
        x: (laid?.x ?? 0) - MAP_NODE_WIDTH / 2,
        y: (laid?.y ?? 0) - MAP_NODE_HEIGHT / 2,
      },
    };
  });
}
