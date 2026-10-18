"use client";

import { GitCompareArrowsIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { alignBranches, type CompareBeat } from "@/lib/branches/compare";
import type { BranchInfo } from "@/lib/branches/types";

/**
 * Compare two branches side-by-side.
 * Strictly read-only: aligned rows, divergence markers, no edit affordances.
 */
export function CompareView({
  left,
  right,
  leftBeats,
  rightBeats,
}: {
  left: BranchInfo;
  right: BranchInfo;
  leftBeats: CompareBeat[];
  rightBeats: CompareBeat[];
}) {
  const rows = alignBranches(leftBeats, rightBeats);
  const divergences = rows.filter((row) => row.divergence).length;

  return (
    <section data-testid="compare-view" aria-label="Branch compare" className="space-y-2">
      <div className="flex items-center gap-1.5">
        <GitCompareArrowsIcon className="size-3.5 text-muted-foreground" aria-hidden />
        <h4 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          Compare · read-only
        </h4>
        <Badge variant="outline" className="ml-auto font-normal">
          {divergences} divergence{divergences === 1 ? "" : "s"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <BranchHeader branch={left} />
        <BranchHeader branch={right} />
      </div>

      <ul className="space-y-1.5">
        {rows.map((row) => (
          <li
            key={row.key}
            data-testid="compare-row"
            data-divergence={row.divergence ? "true" : undefined}
            className={`grid grid-cols-2 gap-2 rounded-lg border p-2 ${
              row.divergence
                ? "border-amber-500/30 bg-amber-500/5"
                : "border-border bg-card/50"
            }`}
          >
            <CompareCell beat={row.left} />
            <CompareCell beat={row.right} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function BranchHeader({ branch }: { branch: BranchInfo }) {
  return (
    <div className="truncate rounded-lg border border-border bg-background/60 px-2 py-1.5 text-xs font-medium">
      {branch.label}
    </div>
  );
}

function CompareCell({ beat }: { beat?: CompareBeat }) {
  if (!beat) {
    return (
      <p className="px-1 text-[11px] text-muted-foreground italic">no beat here</p>
    );
  }
  return (
    <div className="min-w-0">
      <p className="text-[10px] text-muted-foreground">
        {beat.speakerName} · beat {beat.seq}
      </p>
      <p className="mt-0.5 line-clamp-4 text-xs leading-relaxed text-foreground/85">
        {beat.text}
      </p>
    </div>
  );
}
