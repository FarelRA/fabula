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
      <ul className="flex flex-wrap gap-1.5">
        {branches.map((branch) => {
          const selected = branch._id === selectedId;
          return (
            <li key={branch._id}>
              <button
                type="button"
                aria-pressed={selected}
                disabled={!branch.tipBeatId}
                onClick={() => onSelect(branch._id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                  selected
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                  !branch.tipBeatId && "opacity-50",
                )}
              >
                <span
                  aria-hidden
                  className="size-2 rounded-full"
                  style={{ backgroundColor: branchColor(branch.colorIndex ?? 0) }}
                />
                <span className="max-w-52 truncate">{branch.label}</span>
                <Badge variant="outline" className="font-normal">
                  {beatCounts[branch._id] ?? 0}
                </Badge>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
