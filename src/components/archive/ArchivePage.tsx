"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeftIcon,
  DownloadIcon,
  GitBranchIcon,
  ScrollTextIcon,
  Share2Icon,
} from "lucide-react";
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
    <div className="stage-haze min-h-dvh">
      <div className="studio-shell py-8 sm:py-10">
        <header className="flex flex-col gap-5 border-b border-border/70 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 max-w-3xl">
            <div className="flex items-center gap-1.5">
              <Button asChild variant="ghost" size="icon-sm">
                <Link href={`/s/${sceneId}`} aria-label="Back to the scene">
                  <ArrowLeftIcon />
                </Link>
              </Button>
              <p className="cue text-primary">The archive · nothing destroyed</p>
            </div>
            <h1 className="mt-2 font-serif text-3xl leading-[1.05] tracking-[-0.025em] text-balance sm:text-5xl">
              {scene.title}
            </h1>
            <p className="mt-3 max-w-2xl font-serif text-base leading-relaxed text-muted-foreground sm:text-lg">
              {scene.premise}
            </p>
            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-muted-foreground">
              <Badge variant="outline" className="font-normal capitalize">
                {scene.status}
              </Badge>
              {settings ? (
                <span>
                  {settings.genre} · {settings.settingEra} · {settings.presentationStyle}
                </span>
              ) : null}
              <span>
                {scene.endedAt !== undefined
                  ? `ended ${formatDistanceToNow(scene.endedAt, { addSuffix: true })}`
                  : "still playing · live read-only snapshot"}
              </span>
              {usage ? (
                <span>
                  est. {formatUsd(usage.costEstimateUsd)} ·{" "}
                  {formatTokens(usage.tokensIn + usage.tokensOut)} tokens
                </span>
              ) : null}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button type="button" variant="outline" size="sm" onClick={() => setShareOpen(true)}>
              <Share2Icon />
              Share
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setExportOpen(true)}>
              <DownloadIcon />
              Export
            </Button>
          </div>
        </header>

        {scene.status === "archived" ? (
          <p className="mt-5 rounded-md border border-primary/25 bg-primary/[0.06] px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
            This scene is archived. Every branch, beat, ghost path and fact is
            preserved below. Replay is read-only; nothing was deleted.
          </p>
        ) : null}

        <section className="mt-7 space-y-2">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="cue flex items-center gap-1.5 text-primary">
                <GitBranchIcon className="size-3.5" aria-hidden />
                The family tree
              </p>
              <h2 className="mt-1 font-serif text-2xl leading-tight">Branches</h2>
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">
              {branches.length} branch{branches.length === 1 ? "" : "es"} ·{" "}
              {bundle.beats.length} beats
            </span>
          </div>
          <BranchExplorer
            branches={branches}
            selectedId={branchId}
            beatCounts={beatCounts}
            onSelect={setSelectedBranchId}
          />
        </section>

        <section className="mt-8 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border/60 pb-3">
            <div>
              <p className="cue flex items-center gap-1.5 text-primary">
                <ScrollTextIcon className="size-3.5" aria-hidden />
                Sealed script
              </p>
              <h2 className="mt-1 font-serif text-2xl leading-tight">
                Replay · {selectedBranch?.label ?? "Main"}
              </h2>
            </div>
            <Badge variant="outline" className="font-normal">
              {chain.length} beat{chain.length === 1 ? "" : "s"}
            </Badge>
          </div>
          <ArchiveReplay
            chain={chain}
            roles={roleList}
            candidatesByParent={candidatesByParent}
          />
        </section>

        <section className="mt-8 space-y-3">
          <div className="border-b border-border/60 pb-3">
            <p className="cue text-primary">The ledger</p>
            <h2 className="mt-1 font-serif text-2xl leading-tight">
              Facts, summaries and director notes
            </h2>
          </div>
          <ArchiveLedger
            facts={bundle.facts}
            summaries={bundle.summaries}
            notes={bundle.notes}
            warnings={bundle.warnings}
          />
        </section>
      </div>

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
