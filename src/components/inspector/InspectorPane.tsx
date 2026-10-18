"use client";

import dynamic from "next/dynamic";
import { useMutation, useQuery } from "convex/react";
import { BookOpenIcon, CoinsIcon, FileSearchIcon, MapIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { normalizeByTier } from "@/lib/usage/format";
import { isCompareEnabled, type InspectorTab } from "@/lib/inspector/tabs";
import type { PlayScene } from "@/lib/play/types";
import { MemoryPanel } from "./MemoryPanel";
import { PromptInspector } from "./PromptInspector";
import { UsageMeter } from "./UsageMeter";
import type {
  MemoryFactView,
  MemorySummaryView,
  MemoryWarningView,
  SnapshotDetailView,
} from "./types";

const BranchMapView = dynamic(
  () => import("./BranchMapView").then((module) => module.BranchMapView),
  {
    ssr: false,
    loading: () => (
      <div data-testid="branch-map-loading" className="space-y-2">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    ),
  },
);

/**
 * Inspector pane: Memory · Prompts · Map · Usage, driven
 * entirely by the `?inspector=` / `?beat=` URL state so every panel is
 * linkable. Inline on desktop, a sheet everywhere else.
 */
export function InspectorPane({
  scene,
  sceneId,
  tab,
  beatId,
  onTabChange,
  onClose,
  onSelectBeat,
  onInspectBeat,
  onSwitchBranch,
}: {
  scene: PlayScene;
  sceneId: Id<"scenes">;
  tab: InspectorTab;
  beatId?: string;
  onTabChange: (tab: InspectorTab) => void;
  onClose: () => void;
  onSelectBeat: (beatId: string) => void;
  onInspectBeat: (beatId: string) => void;
  onSwitchBranch: (branchId: string) => void;
}) {
  const roleName = (roleId?: string) =>
    scene.roles.find((role) => role.id === roleId)?.card.identity.name ?? "Narration";
  const disabled = scene.status === "archived";

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <Tabs
        value={tab}
        onValueChange={(value) => onTabChange(value as InspectorTab)}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
          <TabsList className="h-7">
            <TabsTrigger value="memory" className="gap-1 text-xs">
              <BookOpenIcon className="size-3.5" aria-hidden />
              Memory
            </TabsTrigger>
            <TabsTrigger value="prompts" className="gap-1 text-xs">
              <FileSearchIcon className="size-3.5" aria-hidden />
              Prompts
            </TabsTrigger>
            <TabsTrigger value="map" className="gap-1 text-xs">
              <MapIcon className="size-3.5" aria-hidden />
              Map
            </TabsTrigger>
            <TabsTrigger value="usage" className="gap-1 text-xs">
              <CoinsIcon className="size-3.5" aria-hidden />
              Usage
            </TabsTrigger>
          </TabsList>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="ml-auto"
            aria-label="Close inspector"
            onClick={onClose}
          >
            <XIcon />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <TabsContent value="memory" className="m-0">
            <MemoryTab scene={scene} sceneId={sceneId} disabled={disabled} />
          </TabsContent>
          <TabsContent value="prompts" className="m-0">
            <PromptsTab
              scene={scene}
              sceneId={sceneId}
              beatId={beatId}
              onSelectBeat={onSelectBeat}
            />
          </TabsContent>
          <TabsContent value="map" className="m-0">
            <BranchMapView
              sceneId={sceneId}
              speakerName={roleName}
              selectedBeatId={beatId}
              compareEnabled={isCompareEnabled()}
              onSelectBeat={onSelectBeat}
              onSwitchBranch={onSwitchBranch}
              onInspectBeat={onInspectBeat}
            />
          </TabsContent>
          <TabsContent value="usage" className="m-0">
            <UsageTab scene={scene} sceneId={sceneId} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function MemoryTab({
  scene,
  sceneId,
  disabled,
}: {
  scene: PlayScene;
  sceneId: Id<"scenes">;
  disabled?: boolean;
}) {
  const facts = useQuery(api.facts.listForScene, { sceneId });
  const summaries = useQuery(api.summaries.listForPath, { sceneId });
  const warnings = useQuery(api.warnings.listForScene, { sceneId });
  const setPinned = useMutation(api.facts.setPinned);
  const setStatus = useMutation(api.facts.setStatus);
  const dismissWarning = useMutation(api.warnings.dismiss);
  const undoLast = useMutation(api.actions.undoLast);

  const seqByBeat = new Map(scene.beats.map((beat) => [beat.id, beat.seq]));
  const factViews: MemoryFactView[] = (facts ?? []).map((fact) => ({
    id: fact._id,
    text: fact.text,
    nodeId: fact.nodeId,
    beatSeq: seqByBeat.get(fact.nodeId),
    status: fact.status,
    isPinned: fact.isPinned,
    onPath: fact.onPath,
    inContext: fact.inContext,
    subjectNames: fact.subjects.map(
      (roleId) =>
        scene.roles.find((role) => role.id === roleId)?.card.identity.name ?? "role",
    ),
    createdAt: fact.createdAt,
  }));
  const summaryViews: MemorySummaryView[] = (summaries ?? []).map((summary) => ({
    id: summary._id,
    text: summary.text,
    coveredFromSeq: summary.coveredFromSeq,
    coveredThroughSeq: summary.coveredThroughSeq,
  }));
  const warningViews: MemoryWarningView[] = (warnings ?? []).map((warning) => ({
    id: warning._id,
    text: warning.text,
    severity: warning.severity,
    status: warning.status,
    beatSeq: seqByBeat.get(warning.beatId),
  }));

  const undo = () => {
    void undoLast({ sceneId }).then((result) => {
      if (result.undone) toast.success("Undone");
    });
  };

  return (
    <MemoryPanel
      facts={factViews}
      summaries={summaryViews}
      warnings={warningViews}
      disabled={disabled}
      onPin={(fact, pinned) => {
        void setPinned({ factId: fact.id as Id<"facts">, pinned }).then(() => {
          toast.success(pinned ? "Pinned global canon" : "Unpinned", {
            description: pinned
              ? "Pinned facts cross branches by explicit override."
              : undefined,
            action: { label: "Undo", onClick: undo },
          });
        });
      }}
      onMute={(fact) => {
        void setStatus({ factId: fact.id as Id<"facts">, status: "muted" }).then(() => {
          toast.success("Fact muted", {
            description: "Muted facts never enter prompts.",
            action: { label: "Undo", onClick: undo },
          });
        });
      }}
      onUnmute={(fact) => {
        void setStatus({ factId: fact.id as Id<"facts">, status: "active" }).then(() => {
          toast.success("Fact unmuted", { action: { label: "Undo", onClick: undo } });
        });
      }}
      onDismissWarning={(warning) => {
        void dismissWarning({ warningId: warning.id as Id<"continuityWarnings"> }).then(
          () => {
            toast.success("Warning dismissed", {
              action: { label: "Undo", onClick: undo },
            });
          },
        );
      }}
    />
  );
}

function PromptsTab({
  scene,
  sceneId,
  beatId,
  onSelectBeat,
}: {
  scene: PlayScene;
  sceneId: Id<"scenes">;
  beatId?: string;
  onSelectBeat: (beatId: string) => void;
}) {
  const beatSnapshots = useQuery(
    api.generation.snapshots.getForBeat,
    beatId ? { beatId: beatId as Id<"beats"> } : "skip",
  );
  const recent = useQuery(
    api.generation.snapshots.listForScene,
    beatId ? "skip" : { sceneId },
  );
  const rows = beatId ? beatSnapshots : recent;
  const detail: SnapshotDetailView[] = (rows ?? []).map((row) => ({
    id: row._id,
    mode: row.mode,
    createdAt: row.createdAt,
    beatId: row.beatId,
    candidateId: row.candidateId,
    roleId: row.roleId,
    model: { provider: row.model.provider, modelId: row.model.modelId },
    tokenCounts: row.tokenCounts,
    budget: {
      contextWindow: row.budget.contextWindow,
      systemTargetPct: row.budget.systemTargetPct,
      overBudgetAction: row.budget.overBudgetAction,
    },
    blocks: row.blocks.map((block) => ({
      key: block.key,
      templateKey: block.templateKey,
      templateVersion: block.templateVersion,
      text: block.text,
      hash: block.hash,
      tokens: block.tokens,
      chars: block.chars,
    })),
  }));

  const beat = beatId ? scene.beats.find((entry) => entry.id === beatId) : undefined;
  const contextLabel = beatId
    ? beat
      ? `beat ${beat.seq}`
      : "selected beat"
    : undefined;

  return (
    <div className="space-y-2">
      {!beatId ? (
        <p className="text-[11px] text-muted-foreground">
          Showing the latest generations. Select a beat on the thread or map to
          inspect its exact compiled prompt.
        </p>
      ) : null}
      <PromptInspector snapshots={detail} contextLabel={contextLabel} />
      {beatId ? (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => onSelectBeat("")}
        >
          Show latest instead
        </Button>
      ) : null}
    </div>
  );
}

function UsageTab({ scene, sceneId }: { scene: PlayScene; sceneId: Id<"scenes"> }) {
  const usage = useQuery(api.usage.getSceneUsage, { sceneId });
  if (!usage) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }
  return (
    <UsageMeter
      usage={{
        tokensIn: usage.tokensIn,
        tokensOut: usage.tokensOut,
        costEstimateUsd: usage.costEstimateUsd,
        byTier: normalizeByTier(usage.byTier),
      }}
      softCapUsd={scene.settings.budget.softUsdCap}
    />
  );
}
