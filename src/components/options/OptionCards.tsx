"use client";

import { useState } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  GitForkIcon,
  LoaderCircleIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RoleAvatar } from "@/components/cast/RoleAvatar";
import { usePlatform } from "@/hooks/usePlatform";
import { roleById, strategyLabel, tipOptions } from "@/lib/play/helpers";
import type { CastRole } from "@/lib/cast/types";
import type { PlayOption } from "@/lib/play/types";
import { cn } from "cn";

const STRATEGY_STYLES: Record<string, string> = {
  escalate: "border-role-rose/40 bg-role-rose/10 text-foreground",
  "de-escalate": "border-role-sky/40 bg-role-sky/10 text-foreground",
  reveal: "border-role-amber/40 bg-role-amber/10 text-foreground",
  conceal: "border-role-violet/40 bg-role-violet/10 text-foreground",
  ally: "border-role-teal/40 bg-role-teal/10 text-foreground",
  confront: "border-role-orange/40 bg-role-orange/10 text-foreground",
  commit: "border-primary/35 bg-primary/10 text-primary",
  deflect: "border-border bg-muted text-muted-foreground",
};

/**
 * Inline path options. Never a modal: 2 to 4 cards live
 * under their parent beat. Ghost candidates under older beats carry a fork
 * warning and pick through a confirmation (handled by the container).
 */
export function OptionCards({
  options,
  roles,
  activeTipId,
  pendingPickId,
  disabled,
  readOnly = false,
  onPick,
}: {
  options: PlayOption[];
  roles: CastRole[];
  activeTipId?: string;
  pendingPickId?: string | null;
  disabled?: boolean;
  /** Shared viewers see the paths but never a pick affordance. */
  readOnly?: boolean;
  onPick: (option: PlayOption) => void;
}) {
  const platform = usePlatform();
  const [showGhosts, setShowGhosts] = useState(false);
  if (options.length === 0) return null;

  const ghostMode = options.every((option) => !option.parentIsTip);
  if (ghostMode && !showGhosts) {
    return (
      <section aria-label="Ghost paths" className="mt-3 border-t border-border/50 pt-2.5">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          aria-expanded={false}
          onClick={() => setShowGhosts(true)}
          className="text-muted-foreground"
        >
          <GitForkIcon />
          {options.length} unused path{options.length === 1 ? "" : "s"} at this beat
          <span className="text-primary">Review</span>
        </Button>
      </section>
    );
  }

  return (
    <section
      aria-label={ghostMode ? "Ghost paths" : "Path options"}
      data-active-tip={activeTipId ?? ""}
      className="mt-3 border-t border-border/50 pt-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h4 className="cue flex items-center gap-1.5 text-[0.6rem] text-primary">
          <GitForkIcon className="size-3" aria-hidden />
          {ghostMode ? "Ghost paths" : "Choose the next beat"}
        </h4>
        <div className="flex items-center gap-2">
          {ghostMode || readOnly ? null : (
            <>
              <span className="hidden font-mono text-[9px] text-muted-foreground sm:inline">
                {platform === "mac" ? "⌥" : "Alt+"}1–{Math.min(4, options.length)}
              </span>
              <span className="sr-only">
                Alt+1 to {Math.min(4, options.length)} picks
              </span>
            </>
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
      <ul className="mt-2 grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-2">
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
                  "group flex h-full flex-col gap-2 rounded-md border border-border/70 bg-background/25 p-3 transition-colors",
                  !fork && "hover:border-primary/45 hover:bg-primary/[0.035]",
                  fork && "border-dashed",
                  pending && "border-primary bg-primary/5",
                )}
              >
                <header className="flex items-start gap-2">
                  {speaker ? (
                    <RoleAvatar
                      name={speaker.card.identity.name}
                      monogram={speaker.card.identity.monogram}
                      accentColor={speaker.card.identity.accentColor}
                      size="sm"
                      className="size-8 text-[10px]"
                    />
                  ) : (
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted/60 font-mono text-[10px] text-muted-foreground">
                      {String(option.optionIndex).padStart(2, "0")}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-semibold text-foreground">
                      {option.label}
                    </p>
                    <p className="truncate font-mono text-[9px] text-muted-foreground">
                      {speaker?.card.identity.name ?? "Narration"}
                      {!fork && !readOnly && shortcut >= 0 && shortcut < 4 ? (
                        <span className="ml-1.5 text-primary/80">
                          {platform === "mac" ? "⌥" : "Alt+"}
                          {shortcut + 1}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn("shrink-0 font-normal", STRATEGY_STYLES[option.strategy])}
                  >
                    {strategyLabel(option.strategy)}
                  </Badge>
                </header>

                <p
                  data-testid="option-text"
                  className="line-clamp-3 font-serif text-[15px] leading-relaxed text-foreground/80"
                >
                  {option.text}
                </p>

                {fork ? (
                  <p className="flex items-start gap-1.5 rounded-sm bg-primary/5 px-2 py-1.5 text-[10px] leading-relaxed text-primary/90">
                    <GitForkIcon className="mt-0.5 size-3 shrink-0" aria-hidden />
                    Offered at beat {option.parentSeq}. Taking it now forks
                    the story; the current branch stays intact.
                  </p>
                ) : null}

                <div className="mt-auto flex items-end justify-between gap-2 border-t border-border/40 pt-2">
                  {readOnly ? (
                    <Badge variant="secondary" className="font-normal">
                      Shared view · read-only
                    </Badge>
                  ) : (
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
                  )}
                  <details className="group/details min-w-0 text-[10px] text-muted-foreground">
                    <summary className="flex cursor-pointer list-none items-center gap-1 hover:text-foreground">
                      Full text
                      <ChevronDownIcon className="size-3 transition-transform group-open/details:rotate-180" />
                    </summary>
                    <p className="mt-1 max-w-prose font-serif text-xs leading-relaxed text-muted-foreground">
                      {option.text}
                    </p>
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
