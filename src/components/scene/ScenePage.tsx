"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { CastProgress } from "@/components/cast/CastProgress";
import { SceneReading } from "@/components/scene/SceneReading";
import { EmptyState } from "@/components/shell/states";
import { loadFixtureScene } from "@/lib/cast/fixtures";
import type { CastScene } from "@/lib/cast/types";

const PlayShell = dynamic(
  () => import("@/components/scene/PlayShell").then((module) => module.PlayShell),
  {
    ssr: false,
    loading: () => <CastProgress label="Opening the scene…" />,
  },
);

function MissingScene({ sceneId }: { sceneId: string }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <EmptyState
        title="This scene could not be found"
        description="It may belong to another browser session, or the link is incomplete."
        action={
          <Link
            href="/new"
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
          >
            Start a new scene
          </Link>
        }
      />
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Scene reference: {sceneId}
      </p>
    </div>
  );
}

function FixturesScene({ sceneId }: { sceneId: string }) {
  const [scene, setScene] = useState<CastScene | null | undefined>(undefined);

  useEffect(() => {
    setScene(loadFixtureScene(sceneId));
  }, [sceneId]);

  if (scene === undefined) return <CastProgress label="Opening the scene…" />;
  if (scene === null) return <MissingScene sceneId={sceneId} />;
  return <SceneReading scene={scene} />;
}

/**
 * Scene route (Phase 5): fixtures-built scenes keep the deterministic Phase-4
 * handoff reading surface; live Convex scenes get the full play shell. The
 * scene id prefix is the discriminator, so one build can serve both demos and
 * real deployments.
 */
export function ScenePage({ sceneId }: { sceneId: string }) {
  if (sceneId.startsWith("fixture_scene_")) {
    return <FixturesScene sceneId={sceneId} />;
  }
  return <PlayShell sceneId={sceneId} />;
}
