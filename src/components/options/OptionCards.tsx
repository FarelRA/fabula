"use client";

import { useState } from "react";
import { CheckIcon, GitForkIcon, LoaderCircleIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RoleAvatar } from "@/components/cast/RoleAvatar";
import { usePlatform } from "@/hooks/usePlatform";
import { roleById, strategyLabel, tipOptions } from "@/lib/play/helpers";
import type { CastRole } from "@/lib/cast/types";
import type { PlayOption } from "@/lib/play/types";
import { cn } from "cn";

const STRATEGY_STYLES: Record<string, string> = {
  escalate: "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-300",
  "de-escalate": "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-300",
  reveal: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  conceal: "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-300",
  ally: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  confront: "border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-300",
  commit: "border-primary/30 bg-primary/10 text-primary",
  deflect: "border-border bg-muted text-muted-foreground",
};

/**
 * Inline path options (PLAN §9.6 / Phase 5.4). Never a modal: 2–4 cards live
 * under their parent beat. Ghost candidates under older beats carry a fork
 * warning and pick through a confirmation (handled by the container).
 */
export function OptionCards({
  options,
  roles,
  activeTipId,
  pendingPickId,
  disabled,
  onPick,
}: {
  options: PlayOption[];
  roles: CastRole[];
  activeTipId?: string;
  pendingPickId?: string | null;
  disabled?: boolean;
  onPick: (option: PlayOption) => void;
}) {
  const platform = usePlatform();
  const [showGhosts, setShowGhosts] = useState(false);
  if (options.length === 0) return null;

  const ghostMode = options.every((option) => !option.parentIsTip);
  if (ghostMode && !showGhosts) {
    return (
      <section
        aria-label="Ghost paths"
        className="mt-3 border-t border-border/60 pt-2"
      >
        <Button
          type="button"
          variant="ghost"
          size="xs"
          aria-expanded={false}
          onClick={() => setShowGhosts(true)}
          className="text-muted-foreground"
        >
          <GitForkIcon />
          {options.length} unused path{options.length === 1 ? "" : "s"} at this
          beat
          <span className="text-primary">Review</span>
        </Button>
      </section>
    );
  }

  return (
    <section
      aria-label={ghostMode ? "Ghost paths" : "Path options"}
      data-active-tip={activeTipId ?? ""}
      className="mt-3 space-y-2 border-t border-border/60 pt-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
          {ghostMode ? "Ghost paths" : "Path options"}
        </h4>
        <div className="flex items-center gap-2">
          {ghostMode ? null : (
            <span className="text-[11px] text-muted-foreground">
              {platform === "mac" ? "⌥" : "Alt+"}1–{Math.min(4, options.length)} picks
            </span>
          )}
          {ghostMode ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              aria-expanded
              onClick={() => setShowGhosts(false)}
            >
              Hide
            </Button>
          ) : null}
        </div>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const speaker = roleById(roles, option.speakerRoleId);
          const fork = !option.parentIsTip;
          const pending = pendingPickId === option.id;
          const shortcut = tipOptions(options).findIndex((entry) => entry.id === option.id);
          return (
            <li key={option.id}>
              <article
                data-testid="option-card"
                aria-label={`Path option ${option.label}${speaker ? `, ${speaker.card.identity.name}` : ""}`}
                className={cn(
                  "flex h-full flex-col gap-2 rounded-xl border border-border bg-background/70 p-3 transition-colors",
                  !fork && "hover:border-primary/40 hover:bg-primary/5",
                  fork && "border-dashed",
                  pending && "border-primary bg-primary/5",
                )}
              >
                <header className="flex items-center gap-2">
                  {speaker ? (
                    <RoleAvatar
                      name={speaker.card.identity.name}
                      monogram={speaker.card.identity.monogram}
                      accentColor={speaker.card.identity.accentColor}
                      size="sm"
                      className="size-8 text-xs"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {option.label}
                      {!fork && shortcut >= 0 && shortcut < 4 ? (
                        <kbd className="ml-2 rounded border border-border px-1 py-0.5 font-sans text-[10px] font-normal text-muted-foreground">
                          {platform === "mac" ? "⌥" : "Alt+"}
                          {shortcut + 1}
                        </kbd>
                      ) : null}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {speaker?.card.identity.name ?? "Narrator"}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn("font-normal", STRATEGY_STYLES[option.strategy])}
                  >
                    {strategyLabel(option.strategy)}
                  </Badge>
                </header>

                <p
                  data-testid="option-text"
                  className="line-clamp-2 text-sm leading-relaxed text-foreground/80"
                >
                  {option.text}
                </p>

                {fork ? (
                  <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
                    <GitForkIcon className="mt-0.5 size-3 shrink-0" aria-hidden />
                    Offered at beat {option.parentSeq}. Taking it now forks the story
                    from there; the current branch stays intact.
                  </p>
                ) : null}

                <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={fork ? "outline" : "default"}
                    disabled={disabled || Boolean(pendingPickId)}
                    onClick={() => onPick(option)}
                    className="min-w-0"
                  >
                    {pending ? (
                      <LoaderCircleIcon className="animate-spin motion-reduce:animate-none" />
                    ) : fork ? (
                      <GitForkIcon />
                    ) : (
                      <CheckIcon />
                    )}
                    {pending ? "Taking…" : fork ? "Fork from here" : "Take this path"}
                  </Button>
                  <details className="text-[11px] text-muted-foreground">
                    <summary className="cursor-pointer">Full text</summary>
                    <p className="mt-1 max-w-prose leading-relaxed">{option.text}</p>
                  </details>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
