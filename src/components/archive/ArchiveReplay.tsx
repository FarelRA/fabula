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
 * Read-only replay list (PLAN §12 Phase 7.2): the archived chain of one
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
    <ol data-testid="archive-replay" className="space-y-3">
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
              className="rounded-xl border border-border border-l-4 bg-card p-3 shadow-sm sm:p-4"
            >
              <header className="flex items-start gap-2.5">
                {speaker ? (
                  <RoleAvatar
                    name={speaker.identity.name}
                    monogram={speaker.identity.monogram}
                    accentColor={speaker.identity.accentColor}
                    size="sm"
                    className="size-9 text-xs"
                  />
                ) : (
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
                    <GitForkIcon className="size-4" aria-hidden />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                    {speaker?.identity.name ?? "Narration"}
                    {beat.isPinned ? (
                      <PinIcon
                        className="size-3.5 text-primary"
                        aria-label="Pinned"
                      />
                    ) : null}
                  </p>
                  <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Badge variant="secondary" className="font-normal">
                      {ORIGIN_LABELS[beat.origin] ?? beat.origin}
                    </Badge>
                    <span>beat {beat.seq}</span>
                    {beat.editedFromBeatId ? <span>· edited fork</span> : null}
                    {beat.status !== "finished" ? <span>· {beat.status}</span> : null}
                  </p>
                </div>
              </header>

              <div className="mt-2">
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/85">
                  {beat.text}
                </p>
              </div>

              {ghosts.length > 0 ? (
                <details className="mt-2 border-t border-border/60 pt-2">
                  <summary className="cursor-pointer text-[11px] text-muted-foreground">
                    {ghosts.length} path{ghosts.length === 1 ? "" : "s"} not taken
                  </summary>
                  <ul className="mt-1.5 space-y-1.5">
                    {ghosts.map((ghost) => (
                      <li
                        key={ghost._id}
                        className="rounded-lg border border-border/70 bg-background/50 p-2"
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
