"use client";

import dynamic from "next/dynamic";
import type { Id } from "@convex/_generated/dataModel";
import { CastProgress } from "@/components/cast/CastProgress";

/**
 * Lazy boundary for the archive route (same contract as the play and share
 * shells): the page renders client-only so direct navigation works without
 * the Convex client ever touching the server render.
 */
const ArchivePage = dynamic(
  () => import("@/components/archive/ArchivePage").then((module) => module.ArchivePage),
  {
    ssr: false,
    loading: () => <CastProgress label="Opening the archive…" />,
  },
);

export function ArchiveRouteClient({ sceneId }: { sceneId: string }) {
  return <ArchivePage sceneId={sceneId as Id<"scenes">} />;
}
