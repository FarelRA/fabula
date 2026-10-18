"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { mapStoryTree } from "@/lib/branches/types";
import { BranchMapCanvas } from "./BranchMapCanvas";

/**
 * Live story-map wrapper (PLAN Phase 6.2). Imported dynamically by the
 * inspector so @xyflow/react + dagre load only when the Map tab opens.
 */
export function BranchMapView({
  sceneId,
  speakerName,
  selectedBeatId,
  compareEnabled,
  onSelectBeat,
  onSwitchBranch,
  onInspectBeat,
}: {
  sceneId: Id<"scenes">;
  speakerName: (roleId?: string) => string;
  selectedBeatId?: string;
  compareEnabled?: boolean;
  onSelectBeat: (beatId: string) => void;
  onSwitchBranch: (branchId: string) => void;
  onInspectBeat?: (beatId: string) => void;
}) {
  const row = useQuery(api.branches.tree, { sceneId });
  const tree = useMemo(() => (row ? mapStoryTree(row) : null), [row]);

  if (!tree) {
    return (
      <div data-testid="branch-map-loading" className="space-y-2">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  }

  return (
    <BranchMapCanvas
      tree={tree}
      speakerName={speakerName}
      selectedBeatId={selectedBeatId}
      compareEnabled={compareEnabled}
      onSelectBeat={onSelectBeat}
      onSwitchBranch={onSwitchBranch}
      onInspectBeat={onInspectBeat}
    />
  );
}
