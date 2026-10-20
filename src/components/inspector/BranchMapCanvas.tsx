"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { formatDistanceToNow } from "date-fns";
import { EyeIcon, GitCompareArrowsIcon, GitForkIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildMapGraph,
  layoutMapGraph,
  MAP_NODE_HEIGHT,
  MAP_NODE_WIDTH,
  type MapNodeData,
} from "@/lib/branches/graph";
import { branchColor } from "@/lib/branches/colors";
import type { CompareBeat } from "@/lib/branches/compare";
import type { StoryTree } from "@/lib/branches/types";
import { CompareView } from "./CompareView";

const ORIGIN_LABELS: Record<string, string> = {
  opening: "Opening",
  turn: "Turn",
  option: "Picked path",
  userInsert: "You wrote",
  edit: "Edited fork",
  regenerate: "Regenerated",
};

type BeatFlowNode = Node<MapNodeData & { selected: boolean }, "beat">;

function BeatMapNode({ data }: NodeProps<BeatFlowNode>) {
  return (
    <div
      data-node-id={data.id}
      style={{
        width: MAP_NODE_WIDTH,
        height: MAP_NODE_HEIGHT,
        borderLeftColor: branchColor(data.colorIndex),
      }}
      className={`rounded-md border border-border/70 border-l-4 bg-card px-2.5 py-1.5 shadow-[var(--panel-shadow)] ${
        data.selected ? "ring-2 ring-primary" : ""
      } ${data.isActive ? "" : "opacity-60"}`}
    >
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <div className="flex items-center gap-1.5">
        <span className="truncate text-xs font-semibold">{data.speakerName}</span>
        <span className="ml-auto text-[10px] text-muted-foreground">
          #{data.seq}
          {data.isTip ? " · tip" : ""}
        </span>
      </div>
      <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">
        {ORIGIN_LABELS[data.origin] ?? data.origin}
        {data.status !== "finished" ? ` · ${data.status}` : ""}
        {data.candidateCount > 0 ? ` · ${data.candidateCount} paths` : ""}
        {data.isPinned ? " · pinned" : ""}
      </p>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
}

const nodeTypes = { beat: BeatMapNode };

/**
 * Story map: React Flow + dagre, beats colored by branch,
 * canon vs alternative edges, metadata side panel (who/how/when), keyboard
 * node list, and (flag-gated) read-only branch compare. Loaded only on demand.
 */
export function BranchMapCanvas({
  tree,
  speakerName,
  selectedBeatId,
  compareEnabled = false,
  onSelectBeat,
  onSwitchBranch,
  onInspectBeat,
}: {
  tree: StoryTree;
  speakerName: (roleId?: string) => string;
  selectedBeatId?: string;
  compareEnabled?: boolean;
  onSelectBeat: (beatId: string) => void;
  onSwitchBranch: (branchId: string) => void;
  onInspectBeat?: (beatId: string) => void;
}) {
  const [compareLeftId, setCompareLeftId] = useState<string>("");
  const [compareRightId, setCompareRightId] = useState<string>("");
  const flowRef = useRef<ReactFlowInstance<BeatFlowNode, Edge> | null>(null);

  const optionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const candidate of tree.candidates) {
      if (candidate.status === "dismissed") continue;
      counts.set(
        candidate.parentBeatId,
        (counts.get(candidate.parentBeatId) ?? 0) + 1,
      );
    }
    return counts;
  }, [tree.candidates]);

  const graph = useMemo(
    () =>
      buildMapGraph({
        beats: tree.beats,
        branches: tree.branches,
        candidates: tree.candidates,
        activeBeatIds: tree.activeBeatIds,
        activeTipBeatId: tree.activeTipBeatId,
        speakerName,
      }),
    [tree, speakerName],
  );

  const laid = useMemo(
    () => layoutMapGraph(graph.nodes, graph.edges),
    [graph.nodes, graph.edges],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      flowRef.current?.fitView({ padding: 0.3, maxZoom: 1 });
    }, 180);
    return () => clearTimeout(timer);
  }, [laid]);

  const flowNodes = useMemo<BeatFlowNode[]>(
    () =>
      laid.map((node) => ({
        id: node.id,
        type: "beat",
        position: node.position,
        data: { ...node, selected: node.id === selectedBeatId },
        draggable: false,
        style: { width: MAP_NODE_WIDTH, height: MAP_NODE_HEIGHT },
      })),
    [laid, selectedBeatId],
  );

  const flowEdges = useMemo<Edge[]>(
    () =>
      graph.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: "smoothstep",
        animated: edge.isActive,
        style: {
          stroke: edge.isActive ? "var(--primary)" : "var(--border)",
          strokeWidth: edge.isActive ? 2 : 1.2,
          strokeDasharray: edge.isActive ? undefined : "4 4",
        },
      })),
    [graph.edges],
  );

  const selected = selectedBeatId
    ? tree.beats.find((beat) => beat.id === selectedBeatId)
    : undefined;
  const selectedBranch = selected
    ? tree.branches.find((branch) => branch.id === selected.branchId)
    : undefined;
  const activeBeatSet = useMemo(
    () => new Set(tree.activeBeatIds),
    [tree.activeBeatIds],
  );

  const beatsFor = (branchId: string): CompareBeat[] =>
    tree.beats
      .filter((beat) => beat.branchId === branchId)
      .sort((a, b) => a.seq - b.seq)
      .map((beat) => ({
        id: beat.id,
        seq: beat.seq,
        depth: beat.depth,
        text: beat.textPreview,
        speakerName: speakerName(beat.speakerRoleId),
        origin: beat.origin,
        status: beat.status,
      }));

  const compareEnabledNow =
    compareEnabled &&
    compareLeftId &&
    compareRightId &&
    compareLeftId !== compareRightId;
  const leftBranch = tree.branches.find((branch) => branch.id === compareLeftId);
  const rightBranch = tree.branches.find((branch) => branch.id === compareRightId);

  return (
    <div data-fabula-map="true" data-testid="branch-map" className="space-y-3">
      <div className="h-[320px] overflow-hidden rounded-md border border-border/70 bg-background/40">
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
          minZoom={0.2}
          maxZoom={1.6}
          colorMode="dark"
          nodesDraggable={false}
          nodesConnectable={false}
          onInit={(instance) => {
            flowRef.current = instance;
            instance.fitView({ padding: 0.3, maxZoom: 1 });
          }}
          onNodeClick={(_event, node) => onSelectBeat(node.id)}
          className="[--xy-background-color:transparent]"
        >
          <Background gap={20} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      {selected ? (
        <section
          data-testid="map-metadata"
          aria-label="Beat metadata"
          className="space-y-1.5 rounded-md border border-border/70 bg-card/40 p-2.5"
        >
          <div className="flex items-center gap-1.5">
            <EyeIcon className="size-3.5 text-muted-foreground" aria-hidden />
            <h4 className="cue text-[0.55rem] text-muted-foreground">
              Beat {selected.seq}
            </h4>
            {selected.isPinned ? (
              <Badge variant="outline" className="font-normal">
                Pinned
              </Badge>
            ) : null}
            <Badge variant="secondary" className="ml-auto font-normal">
              {ORIGIN_LABELS[selected.origin] ?? selected.origin}
            </Badge>
          </div>
          <p className="text-xs">
            <span className="font-medium">{speakerName(selected.speakerRoleId)}</span>
            <span className="text-muted-foreground">
              {" "}
              · {selectedBranch?.label ?? "Branch"} · depth {selected.depth} ·{" "}
              {selected.status}
              {(optionCounts.get(selected.id) ?? 0) > 0
                ? ` · ${optionCounts.get(selected.id)} path options`
                : ""}
            </span>
          </p>
          <p className="line-clamp-3 text-xs leading-relaxed text-foreground/80">
            {selected.textPreview || "(no text yet)"}
          </p>
          <p className="text-[10px] text-muted-foreground">
            created {formatDistanceToNow(selected.createdAt, { addSuffix: true })}
          </p>
          {onInspectBeat ? (
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => onInspectBeat(selected.id)}
            >
              Inspect prompts
            </Button>
          ) : null}
        </section>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Select a beat on the map for who/how/when details.
        </p>
      )}

      <section aria-label="Branches" className="space-y-1">
        <h4 className="cue text-[0.55rem] text-muted-foreground">
          Branches
        </h4>
        <ul className="space-y-1">
          {tree.branches.map((branch) => (
            <li
              key={branch.id}
              className="flex items-center gap-2 rounded-lg border border-border bg-background/50 px-2 py-1.5"
            >
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: branchColor(branch.colorIndex) }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{branch.label}</p>
                <p className="text-[10px] text-muted-foreground">
                  {branch.beatCount} beat{branch.beatCount === 1 ? "" : "s"}
                  {branch.isActive ? " · active" : ""}
                  {branch.forkedFromBeatId ? " · fork" : " · mainline"}
                </p>
              </div>
              {branch.tipBeatId ? (
                <Button
                  type="button"
                  variant={branch.isActive ? "secondary" : "outline"}
                  size="xs"
                  disabled={branch.isActive}
                  onClick={() => onSwitchBranch(branch.id)}
                >
                  {branch.isActive ? "Active" : "Switch"}
                </Button>
              ) : (
                <Badge variant="outline" className="font-normal">
                  empty
                </Badge>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Beats by branch" className="space-y-1">
        <h4 className="cue text-[0.55rem] text-muted-foreground">
          All beats
        </h4>
        <ul
          data-testid="map-node-list"
          className="max-h-56 space-y-0.5 overflow-y-auto rounded-lg border border-border p-1"
        >
          {tree.beats
            .slice()
            .sort((a, b) => a.seq - b.seq)
            .map((beat) => (
              <li key={beat.id}>
                <button
                  type="button"
                  data-testid="map-node-item"
                  aria-pressed={beat.id === selectedBeatId}
                  onClick={() => onSelectBeat(beat.id)}
                  className={`flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] ${
                    beat.id === selectedBeatId
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted"
                  } ${activeBeatSet.has(beat.id) ? "" : "text-muted-foreground"}`}
                >
                  <span
                    aria-hidden
                    className="size-1.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: branchColor(
                        tree.branches.find((branch) => branch.id === beat.branchId)
                          ?.colorIndex ?? 0,
                      ),
                    }}
                  />
                  <span className="truncate">
                    #{beat.seq} {speakerName(beat.speakerRoleId)}
                  </span>
                  {optionCounts.get(beat.id) ? (
                    <GitForkIcon className="ml-auto size-3" aria-hidden />
                  ) : null}
                </button>
              </li>
            ))}
        </ul>
      </section>

      {compareEnabled ? (
        <section aria-label="Compare branches" className="space-y-2">
          <div className="flex items-center gap-1.5">
            <GitCompareArrowsIcon
              className="size-3.5 text-muted-foreground"
              aria-hidden
            />
            <h4 className="cue text-[0.55rem] text-muted-foreground">
              Compare branches
            </h4>
            <Badge variant="outline" className="font-normal">
              flag
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select value={compareLeftId} onValueChange={setCompareLeftId}>
              <SelectTrigger size="sm" aria-label="Compare left branch">
                <SelectValue placeholder="Left branch" />
              </SelectTrigger>
              <SelectContent>
                {tree.branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={compareRightId} onValueChange={setCompareRightId}>
              <SelectTrigger size="sm" aria-label="Compare right branch">
                <SelectValue placeholder="Right branch" />
              </SelectTrigger>
              <SelectContent>
                {tree.branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {compareEnabledNow && leftBranch && rightBranch ? (
            <CompareView
              left={leftBranch}
              right={rightBranch}
              leftBeats={beatsFor(leftBranch.id)}
              rightBeats={beatsFor(rightBranch.id)}
            />
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Pick two different branches to align them read-only.
            </p>
          )}
        </section>
      ) : null}
    </div>
  );
}
