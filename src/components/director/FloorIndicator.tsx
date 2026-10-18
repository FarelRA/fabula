"use client";

import {
  CirclePauseIcon,
  CirclePlayIcon,
  ListTreeIcon,
  OctagonXIcon,
  UsersIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

/**
 * Floor indicator: who is speaking, the next
 * deterministic speaker preview, burst counter, pause/abort and the manual
 * “Offer paths” affordance. Never renders per-token updates.
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
}: {
  scene: PlayScene;
  run: PlayRun | null;
  nextSpeaker?: CastRole;
  queuedCount: number;
  busy?: boolean;
  onPauseToggle: () => void;
  onAbort: () => void;
  onOffer: () => void;
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
    statusLabel = `${openOptions} path${openOptions === 1 ? "" : "s"} open, your direction`;
  else statusLabel = nextSpeaker ? `Next: ${nextSpeaker.card.identity.name}` : "Floor is open";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="flex flex-wrap items-center gap-2 border-b border-border bg-card/60 px-3 py-2"
    >
      {speaker ? (
        <RoleAvatar
          name={speaker.card.identity.name}
          monogram={speaker.card.identity.monogram}
          accentColor={speaker.card.identity.accentColor}
          size="sm"
          className="size-8 text-xs"
        />
      ) : (
        <span className="flex size-8 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
          <UsersIcon className="size-4" aria-hidden />
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{statusLabel}</p>
        <p className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
          <span>Burst {burst}</span>
          {queuedCount > 0 ? <span>· {queuedCount} queued</span> : null}
          {run?.abortRequested ? <span>· stopping…</span> : null}
          {paused ? <span>· direct actions still apply</span> : null}
        </p>
      </div>

      <div className="ml-auto flex items-center gap-1">
        {openOptions > 0 ? (
          <Badge variant="secondary" className="font-normal">
            {openOptions} paths
          </Badge>
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
          variant="outline"
          size="sm"
          onClick={onPauseToggle}
          disabled={busy || archived}
          title={paused ? "Resume auto-floor" : "Pause auto-floor"}
          aria-label={paused ? "Resume auto-floor" : "Pause auto-floor"}
        >
          {paused ? <CirclePlayIcon /> : <CirclePauseIcon />}
          <span className="hidden sm:inline">{paused ? "Resume" : "Pause"}</span>
        </Button>
      </div>
    </div>
  );
}
