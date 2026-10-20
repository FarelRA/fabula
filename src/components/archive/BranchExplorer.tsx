"use client";

import { Badge } from "@/components/ui/badge";
import { branchColor } from "@/lib/branches/colors";
import { cn } from "cn";

/**
 * Branch explorer for the archive: read-only navigation
 * between every branch of the old tree. Selecting a branch replays its chain
 * root → tip; nothing here mutates.
 */
export function BranchExplorer({
  branches,
  selectedId,
  beatCounts,
  onSelect,
}: {
  branches: Array<{ _id: string; label: string; colorIndex?: number; tipBeatId?: string }>;
  selectedId?: string;
  beatCounts: Record<string, number>;
  onSelect: (branchId: string) => void;
}) {
  return (
    <nav aria-label="Branches" data-testid="branch-explorer">
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {branches.map((branch) => {
          const selected = branch._id === selectedId;
          const empty = !branch.tipBeatId;
          return (
            <li key={branch._id}>
              <button
                type="button"
                aria-pressed={selected}
                disabled={empty}
                onClick={() => onSelect(branch._id)}
                style={selected ? { borderTopColor: branchColor(branch.colorIndex ?? 0) } : undefined}
                className={cn(
                  "group flex w-full flex-col gap-1.5 rounded-md border border-t-2 px-3 py-2.5 text-left transition-colors",
                  selected
                    ? "border-primary/35 bg-primary/[0.06]"
                    : "border-border/70 bg-card/30 hover:border-primary/30 hover:bg-muted/40",
                  empty && "opacity-50",
                )}
              >
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: branchColor(branch.colorIndex ?? 0) }}
                  />
                  <span className="truncate font-serif text-lg leading-tight">
                    {branch.label}
                  </span>
                  {selected ? (
                    <Badge variant="outline" className="ml-auto shrink-0 border-primary/30 font-normal text-primary">
                      Viewing
                    </Badge>
                  ) : null}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {beatCounts[branch._id] ?? 0} beat
                  {(beatCounts[branch._id] ?? 0) === 1 ? "" : "s"}
                  {empty ? " · empty" : ""}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
