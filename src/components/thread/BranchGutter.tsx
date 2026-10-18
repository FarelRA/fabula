"use client";

import { GitForkIcon } from "lucide-react";
import { branchColor } from "@/lib/branches/colors";
import type { GutterMarker } from "@/lib/branches/gutter";
import { cn } from "cn";

/**
 * Branch gutter (PLAN §9.7 / Phase 6.1): a vertical rail beside the thread.
 * Active-path beats appear as dots, decision points as diamonds, and other
 * branches as fork chips at their divergence beat. Click scrolls to the beat;
 * clicking a fork switches the active branch (context recomputes, L5).
 */
export function BranchGutter({
  markers,
  selectedBeatId,
  onScrollToBeat,
  onSwitchBranch,
}: {
  markers: GutterMarker[];
  selectedBeatId?: string;
  onScrollToBeat: (beatId: string) => void;
  onSwitchBranch: (marker: GutterMarker) => void;
}) {
  if (markers.length === 0) return null;

  return (
    <nav
      data-testid="branch-gutter"
      aria-label="Story branches"
      className="pointer-events-none absolute inset-y-2 right-0 z-10 hidden w-7 lg:block"
    >
      {markers.map((marker) => {
        const selected = marker.beatId === selectedBeatId;
        const common = {
          title:
            marker.kind === "fork"
              ? `Switch to ${marker.label}`
              : marker.kind === "decision"
                ? `${marker.label} · ${marker.candidateCount} path options`
                : marker.label,
          "aria-label":
            marker.kind === "fork"
              ? `Switch to branch ${marker.label}`
              : `${marker.label}${marker.kind === "decision" ? `, ${marker.candidateCount} path options` : ""}`,
          "aria-current": selected ? ("true" as const) : undefined,
          "data-marker-kind": marker.kind,
          className: cn(
            "pointer-events-auto absolute right-1.5 flex -translate-y-1/2 items-center justify-center border transition-transform hover:scale-125 focus-visible:scale-125 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none",
            marker.kind === "beat" && "size-2.5 rounded-full",
            marker.kind === "decision" && "size-3 rotate-45 rounded-[2px]",
            marker.kind === "fork" && "size-5 rounded-md text-white",
            selected && "ring-2 ring-primary ring-offset-1 ring-offset-background",
            marker.isTip && !selected && "ring-2 ring-primary/50",
            marker.isFailed && "border-destructive",
          ),
          style: {
            top: `${marker.fraction * 100}%`,
            backgroundColor:
              marker.kind === "fork" ? branchColor(marker.colorIndex) : undefined,
            borderColor:
              marker.kind === "fork" ? "transparent" : branchColor(marker.colorIndex),
            color:
              marker.kind === "fork" ? undefined : branchColor(marker.colorIndex),
            ...(marker.kind === "beat" || marker.kind === "decision"
              ? {
                  backgroundColor: selected
                    ? branchColor(marker.colorIndex)
                    : "var(--background)",
                }
              : {}),
          },
        };
        return (
          <button
            key={marker.key}
            type="button"
            {...common}
            onClick={() =>
              marker.kind === "fork"
                ? onSwitchBranch(marker)
                : marker.beatId
                  ? onScrollToBeat(marker.beatId)
                  : undefined
            }
          >
            {marker.kind === "fork" ? (
              <GitForkIcon className="size-3" aria-hidden />
            ) : null}
            {marker.isPinned ? (
              <span
                aria-hidden
                className="absolute -top-1 -right-1 size-1.5 rounded-full bg-foreground"
              />
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
