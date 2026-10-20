"use client";

import { GitForkIcon, PinIcon } from "lucide-react";
import { RoleAvatar } from "@/components/cast/RoleAvatar";
import { Badge } from "@/components/ui/badge";
import { roleAccent } from "@/lib/cast/avatar";
import type {
  ExportBeatRow,
  ExportCandidateRow,
  ExportRoleRow,
} from "@/lib/export/types";

const ORIGIN_LABELS: Record<string, string> = {
  opening: "Opening",
  turn: "Turn",
  option: "Picked path",
  userInsert: "You wrote",
  edit: "Edited",
  regenerate: "Regenerated",
};

/**
 * Read-only replay list: the archived chain of one
 * branch, root → tip, with ghosts preserved as "paths not taken". No menus,
 * no pick buttons, no mutate affordances anywhere.
 */
export function ArchiveReplay({
  chain,
  roles,
  candidatesByParent,
  emptyLabel = "No beats on this branch.",
}: {
  chain: ExportBeatRow[];
  roles: ExportRoleRow[];
  candidatesByParent: Map<string, ExportCandidateRow[]>;
  emptyLabel?: string;
}) {
  if (chain.length === 0) {
    return <p className="text-xs text-muted-foreground">{emptyLabel}</p>;
  }

  const roleById = new Map(roles.map((role) => [role._id, role]));

  return (
    <ol data-testid="archive-replay" className="space-y-1">
      {chain.map((beat) => {
        const speaker = beat.speakerRoleId
          ? roleById.get(beat.speakerRoleId)
          : undefined;
        const ghosts = (candidatesByParent.get(beat._id) ?? []).filter(
          (candidate) => candidate.status === "offered",
        );
        const accent = speaker
          ? `var(--role-${roleAccent(speaker.identity.accentColor ?? "")})`
          : "var(--border)";
        return (
          <li key={beat._id}>
            <article
              data-testid="archive-beat"
              style={{ borderLeftColor: accent }}
              className="border-l-2 py-2 pl-3 sm:pl-4"
            >
              <header className="flex items-center gap-2">
                {speaker ? (
                  <RoleAvatar
                    name={speaker.identity.name}
                    monogram={speaker.identity.monogram}
                    accentColor={speaker.identity.accentColor}
                    size="sm"
                    className="size-7 text-[10px]"
                  />
                ) : (
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
                    <GitForkIcon className="size-3.5" aria-hidden />
                  </span>
                )}
                <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="font-sans text-[11px] font-bold tracking-[0.14em] text-foreground uppercase">
                    {speaker?.identity.name ?? "Narration"}
                  </span>
                  <span className="font-mono text-[9px] text-muted-foreground uppercase">
                    <span>{ORIGIN_LABELS[beat.origin] ?? beat.origin}</span> · beat{" "}
                    {beat.seq}
                    {beat.editedFromBeatId ? " · edited fork" : ""}
                    {beat.status !== "finished" ? ` · ${beat.status}` : ""}
                  </span>
                  {beat.isPinned ? (
                    <PinIcon className="size-3 text-primary" aria-label="Pinned" />
                  ) : null}
                </p>
              </header>

              <div className="mt-1.5">
                <p className="font-serif text-[1.05rem] leading-[1.75] whitespace-pre-wrap text-foreground/85">
                  {beat.text}
                </p>
              </div>

              {ghosts.length > 0 ? (
                <details className="mt-2 border-t border-border/50 pt-2">
                  <summary className="cursor-pointer font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground">
                    {ghosts.length} path{ghosts.length === 1 ? "" : "s"} not taken
                  </summary>
                  <ul className="mt-2 space-y-1.5">
                    {ghosts.map((ghost) => (
                      <li
                        key={ghost._id}
                        className="rounded-sm border border-dashed border-border/70 bg-background/30 p-2"
                      >
                        <p className="flex items-center gap-1.5 text-xs font-medium">
                          {ghost.label}
                          <Badge variant="outline" className="font-normal">
                            {ghost.strategy}
                          </Badge>
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          {ghost.text}
                        </p>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </article>
          </li>
        );
      })}
    </ol>
  );
}
