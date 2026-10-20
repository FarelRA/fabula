"use client";

import {
  CirclePauseIcon,
  CirclePlayIcon,
  ListTreeIcon,
  OctagonXIcon,
  Undo2Icon,
  UsersIcon,
  XCircleIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoleAvatar } from "@/components/cast/RoleAvatar";
import {
  activeRoles,
  burstLabel,
  settingsBurstMax,
  tipOptions,
} from "@/lib/play/helpers";
import type { CastRole } from "@/lib/cast/types";
import type { PlayRun, PlayScene } from "@/lib/play/types";
import { cn } from "cn";

/**
 * Floor indicator: who is speaking, the next
 * deterministic speaker preview, burst counter, pause/abort and the manual
 * "Offer paths" affordance. Never renders per-token updates.
 */
export function FloorIndicator({
  scene,
  run,
  nextSpeaker,
  queuedCount,
  busy,
  onPauseToggle,
  onAbort,
  onOffer,
  canUndo,
  onUndo,
  onEndScene,
  variant = "bar",
}: {
  scene: PlayScene;
  run: PlayRun | null;
  nextSpeaker?: CastRole;
  queuedCount: number;
  busy?: boolean;
  onPauseToggle: () => void;
  onAbort: () => void;
  onOffer: () => void;
  canUndo?: boolean;
  onUndo?: () => void;
  onEndScene?: () => void;
  /** `flush` integrates the strip into an existing scene bar. */
  variant?: "bar" | "flush";
}) {
  const openOptions = tipOptions(scene.options).length;
  const burst = burstLabel(scene.beats, settingsBurstMax(scene.settings));
  const paused = scene.status === "paused";
  const archived = scene.status === "archived";
  const speaker = run?.roleId
    ? activeRoles(scene.roles).find((role) => role.id === run.roleId)
    : nextSpeaker;

  let statusLabel: string;
  if (archived) statusLabel = "Scene archived";
  else if (paused) statusLabel = "Paused, auto-floor is off";
  else if (run) statusLabel = `${run.roleName ?? "The cast"} is speaking…`;
  else if (openOptions > 0)
    statusLabel = `${openOptions} path${openOptions === 1 ? "" : "s"} open`;
  else statusLabel = nextSpeaker ? `Next: ${nextSpeaker.card.identity.name}` : "Floor is open";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        "flex flex-nowrap items-center gap-2 px-3 sm:px-4",
        variant === "bar"
          ? "border-b border-border/70 bg-card/30 py-2"
          : "pb-2 pt-0",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {speaker ? (
          <RoleAvatar
            name={speaker.card.identity.name}
            monogram={speaker.card.identity.monogram}
            accentColor={speaker.card.identity.accentColor}
            size="sm"
            className="size-7 text-[10px]"
          />
        ) : (
          <span className="flex size-7 items-center justify-center rounded-full border border-border bg-muted/50 text-muted-foreground">
            <UsersIcon className="size-3.5" aria-hidden />
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-foreground">{statusLabel}</p>
          <p className="flex flex-wrap items-center gap-1 font-mono text-[9px] text-muted-foreground">
            <span>Burst {burst}</span>
            {queuedCount > 0 ? <span>· {queuedCount} queued</span> : null}
            {run?.abortRequested ? <span className="text-primary">· stopping…</span> : null}
            {paused ? (
              <span className="hidden sm:inline">· direct actions still apply</span>
            ) : null}
          </p>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-1">
        {onUndo ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onUndo}
            disabled={!canUndo || busy}
            title="Undo last action (Ctrl/⌘+Z)"
            aria-label="Undo last action"
          >
            <Undo2Icon />
            <span className="hidden md:inline">Undo</span>
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onOffer}
          disabled={Boolean(run) || busy || archived || !scene.activeTipBeatId}
          title="Offer paths (Ctrl/⌘+Shift+O)"
          aria-label="Offer paths"
        >
          <ListTreeIcon />
          <span className="hidden sm:inline">Offer paths</span>
        </Button>
        {run ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAbort}
            disabled={run.abortRequested}
            title="Abort generation (Ctrl/⌘+.)"
            aria-label="Abort generation"
          >
            <OctagonXIcon />
            <span className="hidden sm:inline">Abort</span>
          </Button>
        ) : null}
        <Button
          type="button"
          variant={paused ? "default" : "outline"}
          size="sm"
          onClick={onPauseToggle}
          disabled={busy || archived}
          title={paused ? "Resume auto-floor" : "Pause auto-floor"}
          aria-label={paused ? "Resume auto-floor" : "Pause auto-floor"}
        >
          {paused ? <CirclePlayIcon /> : <CirclePauseIcon />}
          <span className="hidden sm:inline">{paused ? "Resume" : "Pause"}</span>
        </Button>
        {onEndScene && !archived ? (
          <span className="ml-0.5 border-l border-border/70 pl-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onEndScene}
              disabled={busy}
              title="Wrap and archive this scene"
              aria-label="End scene"
            >
              <XCircleIcon />
              <span className="hidden lg:inline">End scene</span>
            </Button>
          </span>
        ) : null}
      </div>
    </div>
  );
}
