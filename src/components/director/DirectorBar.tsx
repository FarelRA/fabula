"use client";

import {
  CirclePauseIcon,
  CirclePlayIcon,
  ListTreeIcon,
  Undo2Icon,
  XCircleIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PlayScene } from "@/lib/play/types";

/** Director controls: undo, offer, pause, end. */
export function DirectorBar({
  scene,
  canUndo,
  busy,
  onUndo,
  onOffer,
  onPauseToggle,
  onEndScene,
}: {
  scene: PlayScene;
  canUndo: boolean;
  busy?: boolean;
  onUndo: () => void;
  onOffer: () => void;
  onPauseToggle: () => void;
  onEndScene: () => void;
}) {
  const paused = scene.status === "paused";
  const archived = scene.status === "archived";

  return (
    <div
      role="toolbar"
      aria-label="Director controls"
      className="flex flex-wrap items-center gap-1 border-t border-border/60 bg-background/70 px-2 py-1.5 backdrop-blur"
    >
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
        Undo
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onOffer}
        disabled={Boolean(busy) || archived || !scene.activeTipBeatId}
        title="Offer paths (Ctrl/⌘+Shift+O)"
        aria-label="Offer paths"
      >
        <ListTreeIcon />
        Offer paths
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onPauseToggle}
        disabled={busy || archived}
        title={paused ? "Resume auto-floor" : "Pause auto-floor"}
        aria-label={paused ? "Resume auto-floor" : "Pause auto-floor"}
      >
        {paused ? <CirclePlayIcon /> : <CirclePauseIcon />}
        {paused ? "Resume" : "Pause"}
      </Button>
      <span className="ml-auto flex items-center gap-1.5">
        {archived ? (
          <Badge variant="outline" className="font-normal">
            Archived
          </Badge>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={onEndScene}
            disabled={busy}
            title="Wrap and archive this scene"
          >
            <XCircleIcon />
            End scene
          </Button>
        )}
      </span>
    </div>
  );
}
