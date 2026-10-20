"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import {
  ArchiveIcon,
  ArrowRightIcon,
  ClockIcon,
  FileTextIcon,
  LibraryIcon,
  PlusIcon,
  SearchIcon,
  SparklesIcon,
} from "lucide-react";
import { api } from "@convex/_generated/api";
import { EmptyState } from "@/components/shell/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Surface } from "@/components/ui/surface";
import { cn } from "cn";

type SceneStatus = "draft" | "playing" | "paused" | "archived";

type SceneRow = {
  _id: string;
  title: string;
  premise: string;
  status: SceneStatus;
  _creationTime: number;
  endedAt?: number;
  seqCounter: number;
};

const STATUS_LABEL: Record<SceneStatus, string> = {
  draft: "Draft",
  playing: "Playing",
  paused: "Paused",
  archived: "Archived",
};

const STATUS_DOT: Record<SceneStatus, string> = {
  draft: "bg-muted-foreground",
  playing: "bg-role-teal",
  paused: "bg-primary",
  archived: "bg-role-violet",
};

const FILTERS = ["all", "playing", "paused", "draft", "archived"] as const;
type Filter = (typeof FILTERS)[number];

function sceneHref(scene: SceneRow): string {
  return scene.status === "archived" ? `/s/${scene._id}/archive` : `/s/${scene._id}`;
}

function sceneAction(scene: SceneRow): string {
  if (scene.status === "archived") return "Open the archive";
  if (scene.status === "paused") return "Resume directing";
  if (scene.status === "draft") return "Continue the audition";
  return "Resume directing";
}

/**
 * The director's library. Guest scenes arrive through the anonymous session;
 * the list is a quiet shelf of productions rather than an analytics dashboard.
 */
export function SceneLibrary() {
  const configured = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);
  if (!configured) return <OfflineLibrary />;
  return <LiveLibrary />;
}

function LiveLibrary() {
  const scenes = useQuery(api.scenes.listMine);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const rows = useMemo(() => (scenes ?? []) as SceneRow[], [scenes]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((scene) => {
      if (filter !== "all" && scene.status !== filter) return false;
      if (!needle) return true;
      return (
        scene.title.toLowerCase().includes(needle) ||
        scene.premise.toLowerCase().includes(needle)
      );
    });
  }, [rows, filter, query]);

  const counts = useMemo(() => {
    return {
      all: rows.length,
      playing: rows.filter((scene) => scene.status === "playing").length,
      paused: rows.filter((scene) => scene.status === "paused").length,
      draft: rows.filter((scene) => scene.status === "draft").length,
      archived: rows.filter((scene) => scene.status === "archived").length,
    };
  }, [rows]);

  const current = rows.find((scene) => scene.status === "playing" || scene.status === "paused");

  return (
    <LibraryFrame
      counts={counts}
      filter={filter}
      query={query}
      onFilter={setFilter}
      onQuery={setQuery}
      loading={scenes === undefined}
      current={current}
      isEmpty={scenes !== undefined && rows.length === 0}
      filteredEmpty={filtered.length === 0 && rows.length > 0}
    >
      {filtered.map((scene) => (
        <SceneCard key={scene._id} scene={scene} />
      ))}
      <li>
        <Link
          href="/new"
          className="group flex h-full min-h-56 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/80 bg-card/25 p-6 text-center transition-colors hover:border-primary/40 hover:bg-primary/5"
        >
          <span className="flex size-10 items-center justify-center rounded-sm border border-border bg-background/40 text-primary transition-colors group-hover:border-primary/40">
            <PlusIcon className="size-5" aria-hidden />
          </span>
          <span>
            <span className="block font-serif text-xl">Start another production</span>
            <span className="mt-1 block text-sm text-muted-foreground">
              One line is enough to cast a room.
            </span>
          </span>
        </Link>
      </li>
    </LibraryFrame>
  );
}

function OfflineLibrary() {
  const [query, setQuery] = useState("");
  return (
    <LibraryFrame
      counts={{ all: 0, playing: 0, paused: 0, draft: 0, archived: 0 }}
      filter="all"
      query={query}
      onFilter={() => undefined}
      onQuery={setQuery}
      loading={false}
      isEmpty={false}
      filteredEmpty={false}
    >
      <li className="md:col-span-2 xl:col-span-3">
        <EmptyState
          icon={LibraryIcon}
          title="The shelf is waiting"
          description="This demo build keeps scenes in the browser. Start a scene to see it here."
          action={
            <Button asChild>
              <Link href="/new">
                <SparklesIcon aria-hidden />
                Start a scene
              </Link>
            </Button>
          }
        />
      </li>
    </LibraryFrame>
  );
}

function LibraryFrame({
  children,
  counts,
  filter,
  query,
  onFilter,
  onQuery,
  loading,
  current,
  isEmpty,
  filteredEmpty,
}: {
  children: React.ReactNode;
  counts: Record<Filter, number>;
  filter: Filter;
  query: string;
  onFilter: (filter: Filter) => void;
  onQuery: (query: string) => void;
  loading: boolean;
  current?: SceneRow;
  isEmpty: boolean;
  filteredEmpty: boolean;
}) {
  return (
    <div className="stage-haze min-h-[calc(100dvh-3.5rem)]">
      <div className="studio-shell py-10 sm:py-14">
        <header className="flex flex-col gap-5 border-b border-border/70 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="cue flex items-center gap-2 text-primary">
              <LibraryIcon className="size-3.5" aria-hidden />
              The director&apos;s studio
            </p>
            <h1 className="mt-3 font-serif text-4xl leading-[1.05] tracking-[-0.025em] text-balance sm:text-5xl">
              Your repertoire.
            </h1>
            <p className="mt-3 max-w-2xl font-serif text-base leading-relaxed text-muted-foreground sm:text-lg">
              Every production on this stage, from first premise to sealed archive.
              Resume a rehearsal, revisit a finished run, or open a new room.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild>
              <Link href="/new">
                <PlusIcon aria-hidden />
                New scene
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/new/templates">
                <FileTextIcon aria-hidden />
                Templates
              </Link>
            </Button>
          </div>
        </header>

        {current ? (
          <Surface tone="glow" className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-sm border border-primary/30 bg-primary/10 text-primary">
                <SparklesIcon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="cue text-primary">Continue where you left off</p>
                <h2 className="mt-1 truncate font-serif text-2xl leading-tight">
                  {current.title}
                </h2>
                <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                  {current.premise}
                </p>
              </div>
            </div>
            <Button asChild size="lg" className="shrink-0">
              <Link href={sceneHref(current)}>
                {sceneAction(current)}
                <ArrowRightIcon aria-hidden />
              </Link>
            </Button>
          </Surface>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter scenes">
            {FILTERS.map((value) => {
              const active = filter === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onFilter(value)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1.5 text-xs transition-colors",
                    active
                      ? "border-primary/35 bg-primary/10 text-primary"
                      : "border-border/70 bg-card/30 text-muted-foreground hover:border-primary/25 hover:text-foreground",
                  )}
                >
                  <span className="capitalize">{value === "all" ? "All scenes" : value}</span>
                  <span className="font-mono text-[10px] opacity-70">{counts[value]}</span>
                </button>
              );
            })}
          </div>
          <div className="relative w-full lg:max-w-xs">
            <SearchIcon
              className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(event) => onQuery(event.target.value)}
              placeholder="Search titles and premises…"
              aria-label="Search scenes"
              className="pl-9"
            />
          </div>
        </div>

        {loading ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-hidden>
            {Array.from({ length: 3 }, (_, index) => (
              <div
                key={index}
                className="h-64 animate-pulse rounded-lg border border-border/60 bg-card/40 motion-reduce:animate-none"
              />
            ))}
          </div>
        ) : filteredEmpty ? (
          <EmptyState
            title="No scene matches that cue"
            description="Try another word, or clear the filter to see the whole repertoire."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onFilter("all");
                  onQuery("");
                }}
              >
                Clear search
              </Button>
            }
            className="mt-6"
          />
        ) : isEmpty ? null : (
          <ul className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</ul>
        )}

        {isEmpty ? (
          <div className="mt-6">
            <EmptyState
              icon={LibraryIcon}
              title="No productions yet"
              description="The first scene starts with a single line. The cast does the rest."
              action={
                <Button asChild>
                  <Link href="/new">
                    <SparklesIcon aria-hidden />
                    Start your first scene
                  </Link>
                </Button>
              }
            />
          </div>
        ) : null}

        <p className="mt-8 border-t border-border/60 pt-4 text-[11px] leading-relaxed text-muted-foreground">
          Guest scenes live in this browser session. Account claiming is part of
          the sharing release; until then, export a scene from its archive to keep
          a copy.
        </p>
      </div>
    </div>
  );
}

function SceneCard({ scene }: { scene: SceneRow }) {
  const created = new Date(scene._creationTime);
  const coverGradient =
    scene.status === "archived"
      ? "from-role-violet/20 via-card to-background"
      : scene.status === "paused"
        ? "from-primary/20 via-card to-background"
        : "from-role-teal/16 via-card to-background";

  return (
    <li>
      <Surface
        tone="raised"
        padding="none"
        className="group flex h-full flex-col overflow-hidden transition-colors hover:border-primary/35"
      >
        <div
          className={cn(
            "relative flex min-h-28 items-end overflow-hidden border-b border-border/70 bg-gradient-to-br p-4",
            coverGradient,
          )}
        >
          <div className="absolute inset-0 opacity-20 staff-lines" aria-hidden />
          <div className="relative flex w-full items-end justify-between gap-2">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-sm border border-border/70 bg-background/55 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                <span
                  className={cn("size-1.5 rounded-full", STATUS_DOT[scene.status])}
                  aria-hidden
                />
                {STATUS_LABEL[scene.status]}
              </span>
              <h2 className="mt-2 line-clamp-2 font-serif text-2xl leading-tight text-foreground">
                {scene.title}
              </h2>
            </div>
            {scene.status === "archived" ? (
              <ArchiveIcon className="mb-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
            ) : scene.status === "paused" ? (
              <ClockIcon className="mb-1 size-4 shrink-0 text-primary" aria-hidden />
            ) : (
              <SparklesIcon className="mb-1 size-4 shrink-0 text-primary" aria-hidden />
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3 p-4">
          <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
            {scene.premise}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-muted-foreground">
            <span>{scene.seqCounter} beats</span>
            <span aria-hidden>·</span>
            <span>Created {formatDistanceToNow(created, { addSuffix: true })}</span>
          </div>
          <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-3">
            <Badge variant="outline" className="font-normal">
              {scene.status === "archived" ? "Nothing destroyed" : "Full branch tree"}
            </Badge>
            <Link
              href={sceneHref(scene)}
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
            >
              {sceneAction(scene)}
              <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </div>
        </div>
      </Surface>
    </li>
  );
}
