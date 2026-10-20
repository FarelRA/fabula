"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useUIMessages } from "@convex-dev/agent/react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { CastProgress } from "@/components/cast/CastProgress";
import { Wordmark } from "@/components/brand/Wordmark";
import { EmptyState } from "@/components/shell/states";
import { ThreadView } from "@/components/thread/ThreadView";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

  const nextSpeakerName = nextSpeakerPreview(scene)?.card.identity.name;
  const statusText = run
    ? `${run.roleName ?? "The cast"} is speaking…`
    : archived
      ? "The scene has ended. Everything stays readable."
      : scene.status === "paused"
        ? "Paused by the director."
        : nextSpeakerName
          ? `Waiting for ${nextSpeakerName}…`
          : "Waiting for the next beat…";

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[radial-gradient(60rem_28rem_at_50%_-12%,color-mix(in_oklab,var(--primary)_7%,transparent),transparent_62%)]">
      <header className="border-b border-border/70 bg-card/25 px-3 py-2.5 sm:px-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Wordmark
                className="mr-1"
                context={canPick ? "The director's chair" : "The house is watching"}
              />
              <Badge variant={canPick ? "default" : "outline"} className="font-normal">
                {canPick ? "Can pick paths" : "View only"}
              </Badge>
              {archived ? (
                <Badge variant="outline" className="font-normal">
                  Archived
                </Badge>
              ) : null}
            </div>
            <h1 className="mt-1 line-clamp-2 font-serif text-lg leading-tight sm:truncate sm:text-2xl">
              {scene.title}
            </h1>
            <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground sm:truncate">
              {scene.premise}
            </p>
            <p
              role="status"
              aria-live="polite"
              className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground"
            >
              {run ? (
                <span className="relative flex size-2 shrink-0">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60 motion-reduce:hidden" />
                  <span className="relative inline-flex size-2 rounded-full bg-primary" />
                </span>
              ) : null}
              {statusText}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <SharePresence roomToken={token} />
            <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
              <Link href="/new">Direct your own scene</Link>
            </Button>
          </div>
        </div>
      </header>

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
    </div>
  );
}
