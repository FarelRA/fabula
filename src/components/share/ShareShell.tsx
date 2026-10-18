"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useUIMessages } from "@convex-dev/agent/react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { CastProgress } from "@/components/cast/CastProgress";
import { EmptyState } from "@/components/shell/states";
import { ThreadView } from "@/components/thread/ThreadView";
import { Badge } from "@/components/ui/badge";
import { buildPlayScene, mapPlayRun } from "@/lib/play/map";
import { nextSpeakerPreview } from "@/lib/play/helpers";
import { useConnectionState } from "@/hooks/useConnectionState";
import type { PlayOption } from "@/lib/play/types";
import { SharePresence } from "./SharePresence";

/**
 * Shared scene surface. One route for both
 * permissions: tokens are the whole credential. Viewers see the live stream
 * with zero mutate affordances; director links may pick path options through
 * `candidates.pick({shareToken})`. Server-side checks are the real gate.
 * This surface only never *offers* what the token can't do.
 */
export function ShareShell({ token }: { token: string }) {
  const bundle = useQuery(api.shares.getByToken, { token });
  const pick = useMutation(api.candidates.pick);
  const connection = useConnectionState();
  const offline = connection === "offline";
  const [pendingPickId, setPendingPickId] = useState<string | null>(null);

  const scene = useMemo(() => {
    if (!bundle || !bundle.settings) return null;
    return buildPlayScene({
      scene: bundle.scene,
      settings: bundle.settings,
      roles: bundle.roles,
      beats: bundle.beats,
      pending: bundle.pending,
      options: bundle.options,
      notes: bundle.notes,
    });
  }, [bundle]);

  const { results: uiMessages } = useUIMessages(
    api.thread.listMessages,
    bundle?.scene.threadId
      ? {
          sceneId: bundle.scene._id,
          threadId: bundle.scene.threadId,
          shareToken: token,
        }
      : "skip",
    { initialNumItems: 30, stream: true },
  );

  const run = mapPlayRun(bundle?.run);
  const streamingText = useMemo(() => {
    const streaming = [...(uiMessages ?? [])]
      .filter((message) => message.status === "streaming")
      .sort((a, b) => a.order - b.order || a.stepOrder - b.stepOrder);
    return streaming.at(-1)?.text ?? "";
  }, [uiMessages]);

  if (bundle === undefined) {
    return <CastProgress label="Opening the shared scene…" />;
  }

  if (bundle === null || !scene) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <EmptyState
          title="This link is no longer active"
          description="It may have been revoked or expired. Ask the scene's director for a fresh link."
          action={
            <Link
              href="/"
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
            >
              Start your own scene
            </Link>
          }
        />
      </div>
    );
  }

  const canPick =
    bundle.permission === "director" && bundle.scene.status !== "archived";
  const archived = bundle.scene.status === "archived";

  const handlePick = (option: PlayOption) => {
    if (!canPick || offline) return;
    setPendingPickId(option.id);
    void pick({
      candidateId: option.id as Id<"candidates">,
      shareToken: token,
    })
      .then(() => toast.success("Path taken"))
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "Could not pick");
      })
      .finally(() => setPendingPickId(null));
  };

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] min-h-0 flex-col bg-background">
      <header className="flex items-center gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h1 className="truncate font-serif text-lg leading-tight">
              {scene.title}
            </h1>
            <Badge variant={canPick ? "default" : "outline"} className="font-normal">
              {canPick ? "Can pick paths" : "View only"}
            </Badge>
            {archived ? (
              <Badge variant="outline" className="font-normal">
                Archived
              </Badge>
            ) : null}
          </div>
          <p className="truncate text-[11px] text-muted-foreground">
            {scene.premise}
          </p>
        </div>
        <SharePresence roomToken={token} />
      </header>

      <ShareFloor
        run={run}
        sceneStatus={scene.status}
        nextSpeaker={nextSpeakerPreview(scene)?.card.identity.name}
      />

      <ThreadView
        scene={scene}
        run={run}
        streamingText={streamingText}
        optimisticPick={null}
        pendingPickId={canPick ? pendingPickId : null}
        busy={offline}
        readOnly={!canPick}
        onPick={handlePick}
        onPin={() => undefined}
        onEdit={() => undefined}
        onRegenerate={() => undefined}
        onRetry={() => undefined}
      />

      <footer className="border-t border-border px-4 py-2 text-center text-[11px] text-muted-foreground">
        Shared scene · {canPick ? "you can pick path options" : "read-only"} ·
        updates live, nothing is ever deleted
      </footer>
    </div>
  );
}

function ShareFloor({
  run,
  sceneStatus,
  nextSpeaker,
}: {
  run: ReturnType<typeof mapPlayRun>;
  sceneStatus: string;
  nextSpeaker?: string;
}) {
  if (run) {
    return (
      <div
        role="status"
        className="flex items-center gap-2 border-b border-border bg-card/40 px-3 py-1.5 text-xs"
      >
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60 motion-reduce:hidden" />
          <span className="relative inline-flex size-2 rounded-full bg-primary" />
        </span>
        <span className="font-medium">{run.roleName ?? "The cast"}</span>
        <span className="text-muted-foreground">is speaking…</span>
      </div>
    );
  }
  return (
    <div
      role="status"
      className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-xs text-muted-foreground"
    >
      {sceneStatus === "archived"
        ? "The scene has ended. Everything stays readable."
        : sceneStatus === "paused"
          ? "Paused by the director."
          : nextSpeaker
            ? `Waiting for ${nextSpeaker}…`
            : "Waiting for the next beat…"}
    </div>
  );
}
