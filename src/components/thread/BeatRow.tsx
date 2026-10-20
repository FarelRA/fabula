"use client";

import {
  FileSearchIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PinIcon,
  PinOffIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SparklesIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { RoleAvatar } from "@/components/cast/RoleAvatar";
import { BeatContent } from "@/components/thread/BeatContent";
import { OptionCards } from "@/components/options/OptionCards";
import { roleAccent } from "@/lib/cast/avatar";
import type { CastRole } from "@/lib/cast/types";
import { originLabel } from "@/lib/play/helpers";
import type { PlayBeat, PlayOption } from "@/lib/play/types";
import type { PresentationStyle } from "@convex/shared/contracts";
import { cn } from "cn";

export function BeatRow({
  beat,
  speaker,
  style,
  roles,
  isTip,
  options,
  streamingText,
  pendingPickId,
  disabled,
  selected,
  readOnly = false,
  onPick,
  onPin,
  onEdit,
  onRegenerate,
  onRetry,
  onInspect,
}: {
  beat: PlayBeat;
  speaker?: CastRole;
  style: PresentationStyle;
  roles: CastRole[];
  isTip: boolean;
  options: PlayOption[];
  streamingText?: string;
  pendingPickId?: string | null;
  disabled?: boolean;
  selected?: boolean;
  /** Shared viewers: no menus, no retries, no pick buttons. */
  readOnly?: boolean;
  onPick: (option: PlayOption) => void;
  onPin: (pinned: boolean) => void;
  onEdit: (beat: PlayBeat) => void;
  onRegenerate: (beat: PlayBeat) => void;
  onRetry: (beat: PlayBeat) => void;
  onInspect?: (beat: PlayBeat) => void;
}) {
  const streaming = beat.status === "streaming";
  const failed = beat.status === "failed";
  const text = streaming ? (streamingText ?? beat.text) : beat.text;
  const speakerName = speaker?.card.identity.name ?? "Narration";
  const accent = speaker
    ? `var(--role-${roleAccent(speaker.card.identity.accentColor)})`
    : "var(--border)";
  const origin = originLabel(beat);
  const canRegenerate =
    !streaming &&
    !failed &&
    !beat.optimistic &&
    (!speaker || speaker.kind === "ai");

  if (failed) {
    return (
      <article
        data-testid="beat-row"
        aria-label={`Failed beat from ${speakerName}`}
        className="rounded-md border border-destructive/40 bg-destructive/5 p-3"
      >
        <div className="flex items-start gap-2">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-destructive/30 text-destructive">
            <RotateCcwIcon className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-medium">{speakerName}&apos;s attempt failed</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              The partial text was kept off the active path. The scene is intact;
              try the beat again or steer the cast.
            </p>
            {beat.text ? (
              <p className="rounded-sm bg-muted/50 px-2 py-1 text-xs text-muted-foreground">
                Partial: {beat.text}
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => onRetry(beat)}
            className={readOnly ? "hidden" : undefined}
          >
            <RotateCcwIcon />
            Retry
          </Button>
        </div>
      </article>
    );
  }

  return (
    <article
      data-testid="beat-row"
      aria-label={`Beat ${beat.seq} from ${speakerName}`}
      style={{ borderLeftColor: accent }}
      className={cn(
        "group/beat relative border-l-2 py-2 pl-3 transition-colors sm:pl-5",
        "hover:border-l-[3px]",
        isTip && "bg-gradient-to-r from-primary/[0.045] to-transparent",
        selected && "bg-primary/[0.055]",
        beat.optimistic && "animate-pulse motion-reduce:animate-none",
      )}
    >
      <header className="flex items-start gap-2">
        {speaker ? (
          <RoleAvatar
            name={speaker.card.identity.name}
            monogram={speaker.card.identity.monogram}
            accentColor={speaker.card.identity.accentColor}
            size="sm"
            imageUrl={speaker.avatarUrl}
            className="mt-0.5 size-7 text-[10px] ring-1 ring-background"
          />
        ) : (
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted/60 text-muted-foreground">
            <SparklesIcon className="size-3.5" aria-hidden />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="font-sans text-[11px] font-bold tracking-[0.14em] text-foreground uppercase">
              {speakerName}
            </h3>
            {origin ? (
              <span className="font-mono text-[9px] tracking-[0.05em] text-muted-foreground uppercase">
                {origin}
              </span>
            ) : null}
            {beat.isPinned ? (
              <span className="inline-flex items-center gap-1 font-mono text-[9px] text-primary">
                <PinIcon className="size-2.5" aria-hidden />
                Pinned
              </span>
            ) : null}
            {streaming ? (
              <span className="inline-flex items-center gap-1 font-mono text-[9px] text-primary" role="status">
                <span className="size-1 animate-pulse rounded-full bg-primary motion-reduce:animate-none" aria-hidden />
                speaking
              </span>
            ) : null}
            <span className="ml-auto font-mono text-[9px] text-muted-foreground/70">
              beat {beat.seq}
              {beat.optimistic ? " · taking path" : ""}
            </span>
          </div>
        </div>

        {readOnly ? null : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Actions for beat ${beat.seq}`}
                disabled={disabled || beat.optimistic}
                className="text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:text-foreground data-[state=open]:text-foreground"
              >
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onPin(!beat.isPinned)}>
                {beat.isPinned ? <PinOffIcon /> : <PinIcon />}
                {beat.isPinned ? "Unpin beat" : "Pin beat"}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onEdit(beat)}>
                <PencilIcon />
                Edit (forks)
              </DropdownMenuItem>
              {onInspect ? (
                <DropdownMenuItem onSelect={() => onInspect(beat)}>
                  <FileSearchIcon />
                  Inspect prompts
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onRegenerate(beat)} disabled={!canRegenerate}>
                <RefreshCwIcon />
                Regenerate (forks)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      <div className="mt-1.5">
        {streaming && !text ? (
          <div className="space-y-2 py-1" aria-hidden>
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : (
          <BeatContent text={text} style={style} streaming={streaming} />
        )}
        {streaming ? (
          <span className="sr-only" aria-live="polite">
            {speakerName} is speaking
          </span>
        ) : null}
      </div>

      {options.length > 0 ? (
        <OptionCards
          options={options}
          roles={roles}
          activeTipId={isTip ? beat.id : undefined}
          pendingPickId={pendingPickId}
          disabled={disabled}
          readOnly={readOnly}
          onPick={onPick}
        />
      ) : null}
    </article>
  );
}
