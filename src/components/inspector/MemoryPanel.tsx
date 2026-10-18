"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangleIcon,
  ChevronDownIcon,
  EyeOffIcon,
  GlobeIcon,
  PinIcon,
  PinOffIcon,
  ScrollTextIcon,
  VolumeXIcon,
  Volume2Icon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  MemoryFactView,
  MemorySummaryView,
  MemoryWarningView,
} from "./types";

/**
 * Memory panel: what the active path remembers.
 * Path facts, global pins (visually distinct, they cross branches by
 * explicit override), muted rows, off-path exclusions, summaries and
 * continuity warnings. Pin/mute are reversible.
 */
export function MemoryPanel({
  facts,
  summaries,
  warnings,
  onPin,
  onMute,
  onUnmute,
  onDismissWarning,
  disabled,
}: {
  facts: MemoryFactView[];
  summaries: MemorySummaryView[];
  warnings: MemoryWarningView[];
  onPin: (fact: MemoryFactView, pinned: boolean) => void;
  onMute: (fact: MemoryFactView) => void;
  onUnmute: (fact: MemoryFactView) => void;
  onDismissWarning: (warning: MemoryWarningView) => void;
  disabled?: boolean;
}) {
  const [showMuted, setShowMuted] = useState(false);
  const [showOffPath, setShowOffPath] = useState(false);

  const groups = useMemo(() => {
    const active = facts.filter(
      (fact) => fact.status === "active" && !fact.isPinned,
    );
    return {
      pinned: facts.filter((fact) => fact.isPinned && fact.status === "active"),
      onPath: active.filter((fact) => fact.onPath),
      offPath: active.filter((fact) => !fact.onPath),
      muted: facts.filter((fact) => fact.status === "muted"),
    };
  }, [facts]);

  return (
    <div data-testid="memory-panel" className="space-y-4">
      {warnings.length > 0 ? (
        <section aria-label="Continuity warnings" className="space-y-2">
          <SectionHeading icon={<AlertTriangleIcon />} title="Continuity" count={warnings.length} />
          <ul className="space-y-2">
            {warnings.map((warning) => (
              <li
                key={warning.id}
                data-testid="warning-row"
                className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5"
              >
                <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-300" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-xs leading-relaxed">{warning.text}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    <SeverityLabel severity={warning.severity} />
                    {warning.beatSeq ? ` · beat ${warning.beatSeq}` : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={disabled}
                  onClick={() => onDismissWarning(warning)}
                >
                  Dismiss
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-label="Facts in context" className="space-y-2">
        <SectionHeading
          icon={<ScrollTextIcon />}
          title="In context"
          count={groups.onPath.length + groups.pinned.length}
        />
        {groups.onPath.length === 0 && groups.pinned.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No facts on this path yet. The memory pass adds them as the scene
            unfolds.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {groups.pinned.map((fact) => (
              <FactRow
                key={fact.id}
                fact={fact}
                global
                disabled={disabled}
                onPin={onPin}
                onMute={onMute}
                onUnmute={onUnmute}
              />
            ))}
            {groups.onPath.map((fact) => (
              <FactRow
                key={fact.id}
                fact={fact}
                disabled={disabled}
                onPin={onPin}
                onMute={onMute}
                onUnmute={onUnmute}
              />
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Summaries" className="space-y-2">
        <SectionHeading
          icon={<ScrollTextIcon />}
          title="Summaries"
          count={summaries.length}
        />
        {summaries.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No rolling summaries yet.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {summaries.map((summary) => (
              <li
                key={summary.id}
                className="rounded-lg border border-border bg-card/60 p-2.5"
              >
                <p className="text-xs leading-relaxed text-foreground/85">
                  {summary.text}
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  covers beats {summary.coveredFromSeq} to {summary.coveredThroughSeq}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {groups.offPath.length > 0 ? (
        <Disclosure
          label={`${groups.offPath.length} off-path fact${
            groups.offPath.length === 1 ? "" : "s"
          } excluded from context`}
          open={showOffPath}
          onToggle={() => setShowOffPath((value) => !value)}
        >
          <p className="mb-2 text-[10px] text-muted-foreground">
            Facts here belong to other branches. Pin one to make it global
            canon that crosses branches.
          </p>
          <ul className="space-y-1.5">
            {groups.offPath.map((fact) => (
              <FactRow
                key={fact.id}
                fact={fact}
                dim
                disabled={disabled}
                onPin={onPin}
                onMute={onMute}
                onUnmute={onUnmute}
              />
            ))}
          </ul>
        </Disclosure>
      ) : null}

      {groups.muted.length > 0 ? (
        <Disclosure
          label={`${groups.muted.length} muted fact${
            groups.muted.length === 1 ? "" : "s"
          }`}
          open={showMuted}
          onToggle={() => setShowMuted((value) => !value)}
        >
          <ul className="space-y-1.5">
            {groups.muted.map((fact) => (
              <FactRow
                key={fact.id}
                fact={fact}
                dim
                disabled={disabled}
                onPin={onPin}
                onMute={onMute}
                onUnmute={onUnmute}
              />
            ))}
          </ul>
        </Disclosure>
      ) : null}
    </div>
  );
}

function SectionHeading({
  icon,
  title,
  count,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
}) {
  return (
    <h3 className="flex items-center gap-1.5 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
      <span aria-hidden className="[&_svg]:size-3.5">
        {icon}
      </span>
      {title}
      <Badge variant="outline" className="ml-auto font-normal">
        {count}
      </Badge>
    </h3>
  );
}

function SeverityLabel({ severity }: { severity: MemoryWarningView["severity"] }) {
  return (
    <span className="uppercase">
      {severity === "high" ? "high severity" : severity}
    </span>
  );
}

function Disclosure({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-center gap-1.5 px-2.5 py-2 text-left text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronDownIcon
          aria-hidden
          className={`size-3.5 transition-transform ${open ? "" : "-rotate-90"}`}
        />
        {label}
      </button>
      {open ? <div className="px-2.5 pb-2.5">{children}</div> : null}
    </section>
  );
}

function FactRow({
  fact,
  global = false,
  dim = false,
  disabled,
  onPin,
  onMute,
  onUnmute,
}: {
  fact: MemoryFactView;
  global?: boolean;
  dim?: boolean;
  disabled?: boolean;
  onPin: (fact: MemoryFactView, pinned: boolean) => void;
  onMute: (fact: MemoryFactView) => void;
  onUnmute: (fact: MemoryFactView) => void;
}) {
  return (
    <li
      data-testid="fact-row"
      data-global={global ? "true" : undefined}
      data-muted={fact.status === "muted" ? "true" : undefined}
      className={`rounded-lg border p-2.5 ${
        global
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-card/60"
      } ${dim ? "opacity-80" : ""}`}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs leading-relaxed text-foreground/85">{fact.text}</p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
            {global ? (
              <span className="inline-flex items-center gap-1 text-primary">
                <GlobeIcon className="size-3" aria-hidden />
                Global · crosses branches
              </span>
            ) : null}
            {fact.beatSeq ? <span>beat {fact.beatSeq}</span> : <span>off-path</span>}
            {fact.subjectNames.length > 0 ? (
              <span>· {fact.subjectNames.join(", ")}</span>
            ) : null}
            {fact.status === "muted" ? (
              <span className="inline-flex items-center gap-1">
                <EyeOffIcon className="size-3" aria-hidden />
                muted
              </span>
            ) : null}
          </p>
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          disabled={disabled}
          aria-label={fact.isPinned ? `Unpin fact: ${fact.text}` : `Pin fact: ${fact.text}`}
          onClick={() => onPin(fact, !fact.isPinned)}
        >
          {fact.isPinned ? <PinOffIcon /> : <PinIcon />}
          {fact.isPinned ? "Unpin" : "Pin global"}
        </Button>
        {fact.status === "muted" ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={disabled}
            aria-label={`Unmute fact: ${fact.text}`}
            onClick={() => onUnmute(fact)}
          >
            <Volume2Icon />
            Unmute
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={disabled}
            aria-label={`Mute fact: ${fact.text}`}
            onClick={() => onMute(fact)}
          >
            <VolumeXIcon />
            Mute
          </Button>
        )}
      </div>
    </li>
  );
}
