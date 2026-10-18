"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { CastProgress } from "@/components/cast/CastProgress";
import { SceneReading } from "@/components/scene/SceneReading";
import { EmptyState } from "@/components/shell/states";
import { loadFixtureScene } from "@/lib/cast/fixtures";
import { castSceneFromLive } from "@/lib/cast/liveMapping";
import { isFixturesMode } from "@/lib/cast/mode";
import type { CastScene } from "@/lib/cast/types";

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

function LiveScene({ sceneId }: { sceneId: string }) {
  const id = sceneId as Id<"scenes">;
  const sceneData = useQuery(api.scenes.get, { sceneId: id });
  const roles = useQuery(api.cast.listRoles, { sceneId: id });
  const path = useQuery(api.beats.listPath, { sceneId: id });

  if (sceneData === undefined || roles === undefined || path === undefined) {
    return <CastProgress label="Opening the scene…" />;
  }
  if (!sceneData?.scene || !sceneData.settings) {
    return <MissingScene sceneId={sceneId} />;
  }

  const scene = castSceneFromLive({
    scene: sceneData.scene,
    settings: sceneData.settings,
    roles,
    beats: path.beats,
  });
  return <SceneReading scene={scene} />;
}

/**
 * Scene page entry (Phase 4): fixtures read from the session, live reads from
 * Convex. Phase 5 replaces the reading surface with the full play shell; the
 * data mapping and route stay.
 */
export function ScenePage({ sceneId }: { sceneId: string }) {
  return isFixturesMode() ? (
    <FixturesScene sceneId={sceneId} />
  ) : (
    <LiveScene sceneId={sceneId} />
  );
}
