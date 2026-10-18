"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeftIcon, DownloadIcon, Share2Icon } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { CastProgress } from "@/components/cast/CastProgress";
import { EmptyState } from "@/components/shell/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExportDialog } from "@/components/scenes/ExportDialog";
import { ShareDialog } from "@/components/scenes/ShareDialog";
import { chainForDocs } from "@/lib/branches/chain";
import type { ExportBundle } from "@/lib/export/types";
import { formatTokens, formatUsd } from "@/lib/usage/format";
import { ArchiveLedger } from "./ArchiveLedger";
import { ArchiveReplay } from "./ArchiveReplay";
import { BranchExplorer } from "./BranchExplorer";

/**
 * Archive view: read-only replay of any branch
 * with the full branch explorer, ledger and exports. Works for playing scenes
 * too (a live snapshot), but archived scenes are the point: nothing here can
 * mutate, and the wrap banner links back to the frozen play shell.
 */
export function ArchivePage({ sceneId }: { sceneId: Id<"scenes"> }) {
  const bundle = useQuery(api.exportScene.getBundle, { sceneId });
  const usage = useQuery(api.usage.getSceneUsage, { sceneId });
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [includeSnapshots, setIncludeSnapshots] = useState(false);
  const snapshotBundle = useQuery(
    api.exportScene.getBundle,
    exportOpen && includeSnapshots ? { sceneId, includeSnapshots: true } : "skip",
  );

  const branches = bundle?.branches ?? [];
  const roleList = bundle?.roles ?? [];

  const branchId = useMemo(() => {
    if (selectedBranchId) return selectedBranchId;
    const all = bundle?.branches ?? [];
    const active = bundle?.scene.activeBranchId;
    if (active && all.some((branch) => branch._id === active)) return active;
    return all[0]?._id;
  }, [bundle, selectedBranchId]);

  const selectedBranch = branches.find((branch) => branch._id === branchId);

  const chain = useMemo(
    () =>
      bundle && selectedBranch
        ? chainForDocs(selectedBranch.tipBeatId, bundle.beats)
        : [],
    [bundle, selectedBranch],
  );

  const candidatesByParent = useMemo(() => {
    const map = new Map<string, NonNullable<typeof bundle>["candidates"]>();
    if (!bundle) return map;
    for (const candidate of bundle.candidates) {
      const list = map.get(candidate.parentBeatId) ?? [];
      list.push(candidate);
      map.set(candidate.parentBeatId, list);
    }
    return map;
  }, [bundle]);

  const beatCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const beat of bundle?.beats ?? []) {
      counts[beat.branchId] = (counts[beat.branchId] ?? 0) + 1;
    }
    return counts;
  }, [bundle]);

  if (bundle === undefined) {
    return <CastProgress label="Opening the archive…" />;
  }

  if (bundle === null) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <EmptyState
          title="This scene could not be found"
          description="It may belong to another browser session, or the link is incomplete."
          action={
            <Link
              href="/"
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
            >
              Start a new scene
            </Link>
          }
        />
      </div>
    );
  }

  const { scene, settings } = bundle;
  const exportBundle: ExportBundle = includeSnapshots
    ? ((snapshotBundle ?? null) as unknown as ExportBundle)
    : (bundle as unknown as ExportBundle);

  return (
    <div className="mx-auto w-full max-w-5xl px-3 py-5 sm:px-5">
      <header className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Button
              asChild
              variant="ghost"
              size="icon-sm"
            >
              <Link href={`/s/${sceneId}`} aria-label="Back to the scene">
                <ArrowLeftIcon />
              </Link>
            </Button>
            <h1 className="truncate font-serif text-2xl">{scene.title}</h1>
            <Badge variant="outline" className="font-normal">
              {scene.status}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{scene.premise}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {settings
              ? `${settings.genre} · ${settings.settingEra} · ${settings.presentationStyle} · `
              : ""}
            {scene.endedAt !== undefined
              ? `ended ${formatDistanceToNow(scene.endedAt, { addSuffix: true })}`
              : "still playing, and this replay is a live read-only snapshot"}
            {usage
              ? ` · est. ${formatUsd(usage.costEstimateUsd)} · ${formatTokens(
                  usage.tokensIn + usage.tokensOut,
                )} tokens`
              : ""}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShareOpen(true)}
          >
            <Share2Icon />
            Share
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setExportOpen(true)}
          >
            <DownloadIcon />
            Export
          </Button>
        </div>
      </header>

      {scene.status === "archived" ? (
        <p className="mt-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          This scene is archived. Every branch, beat, ghost path and fact is
          preserved below, replay is read-only, and nothing was deleted.
        </p>
      ) : null}

      <section className="mt-4 space-y-1.5">
        <h2 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          Branches
        </h2>
        <BranchExplorer
          branches={branches}
          selectedId={branchId}
          beatCounts={beatCounts}
          onSelect={setSelectedBranchId}
        />
      </section>

      <section className="mt-5 space-y-3">
        <h2 className="flex items-center gap-1.5 text-sm font-medium">
          Replay
          <span className="text-muted-foreground">·</span>
          <span className="truncate text-muted-foreground">
            {selectedBranch?.label ?? "Main"}
          </span>
          <Badge variant="outline" className="font-normal">
            {chain.length} beat{chain.length === 1 ? "" : "s"}
          </Badge>
        </h2>
        <ArchiveReplay
          chain={chain}
          roles={roleList}
          candidatesByParent={candidatesByParent}
        />
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-sm font-medium">Ledger</h2>
        <ArchiveLedger
          facts={bundle.facts}
          summaries={bundle.summaries}
          notes={bundle.notes}
          warnings={bundle.warnings}
        />
      </section>

      <ShareDialog sceneId={sceneId} open={shareOpen} onOpenChange={setShareOpen} />
      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        bundle={exportBundle}
        sceneTitle={scene.title}
        includeSnapshots={includeSnapshots}
        onIncludeSnapshotsChange={setIncludeSnapshots}
      />
    </div>
  );
}
