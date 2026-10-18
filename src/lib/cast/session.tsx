"use client";

import type { ReactNode } from "react";
import { FixturesCastSession } from "./fixturesSession";
import { LiveCastSession } from "./liveSession";
import type { CastScene } from "./types";

export { useCastSession } from "./sessionContext";

type CastSessionProviderProps = {
  children: ReactNode;
  /** Tests pass this explicitly; the app decides from the build env. */
  mode?: "fixtures" | "live";
  initialScene?: CastScene;
  initialSceneId?: string;
};

/**
 * Cast session boundary (Phase 4): fixtures for deterministic development and
 * E2E, Convex for real deployments. Without a backend URL the app falls back
 * to fixtures so the director's chair is never a blank screen.
 */
export function CastSessionProvider({
  children,
  mode,
  initialScene,
  initialSceneId,
}: CastSessionProviderProps) {
  const hasBackend = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);
  const resolvedMode =
    mode ??
    (process.env.NEXT_PUBLIC_FIXTURES === "1" || !hasBackend ? "fixtures" : "live");

  if (resolvedMode === "fixtures") {
    return (
      <FixturesCastSession initialScene={initialScene} initialSceneId={initialSceneId}>
        {children}
      </FixturesCastSession>
    );
  }

  return (
    <LiveCastSession initialSceneId={initialSceneId}>{children}</LiveCastSession>
  );
}
