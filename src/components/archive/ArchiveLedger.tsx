"use client";

import { Badge } from "@/components/ui/badge";
import type {
  ExportFactRow,
  ExportNoteRow,
  ExportSummaryRow,
  ExportWarningRow,
} from "@/lib/export/types";

/**
 * Ledger sections of the archive: the frozen facts,
 * summaries, director notes and continuity warnings of the archived scene.
 * Purely informational, every action here is a read.
 */
export function ArchiveLedger({
  facts,
  summaries,
  notes,
  warnings,
}: {
  facts: ExportFactRow[];
  summaries: ExportSummaryRow[];
  notes: ExportNoteRow[];
  warnings: ExportWarningRow[];
}) {
  return (
    <div data-testid="archive-ledger" className="grid gap-3 lg:grid-cols-2">
      <section
        aria-label="Facts"
        className="rounded-md border border-border/70 bg-card/30 p-4"
      >
        <h3 className="cue text-[0.55rem] text-muted-foreground">
          Facts · {facts.length}
        </h3>
        {facts.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            No facts were recorded.
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {facts.map((fact) => (
              <li key={fact._id} className="flex flex-wrap items-start gap-1.5 text-xs">
                <span className="leading-relaxed text-foreground/85">
                  {fact.text}
                </span>
                {fact.isPinned ? (
                  <Badge variant="outline" className="font-normal text-primary">
                    global
                  </Badge>
                ) : null}
                {fact.status === "muted" ? (
                  <Badge variant="outline" className="font-normal">
                    muted
                  </Badge>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-label="Summaries"
        className="rounded-md border border-border/70 bg-card/30 p-4"
      >
        <h3 className="cue text-[0.55rem] text-muted-foreground">
          Summaries · {summaries.length}
        </h3>
        {summaries.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            No rolling summaries yet.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {summaries.map((summary) => (
              <li key={summary._id}>
                <p className="text-xs leading-relaxed text-foreground/85">
                  {summary.text}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  covers beats {summary.coveredFromSeq} to {summary.coveredThroughSeq}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {notes.length > 0 ? (
        <section
          aria-label="Director notes"
          className="rounded-md border border-border/70 bg-card/30 p-4"
        >
          <h3 className="cue text-[0.55rem] text-muted-foreground">
            Director notes · {notes.length}
          </h3>
          <ul className="mt-2 space-y-1.5">
            {notes.map((note) => (
              <li key={note._id} className="text-xs leading-relaxed text-foreground/85">
                <span className="text-muted-foreground">
                  [{note.kind}
                  {note.status !== "active" ? ` · ${note.status}` : ""}]{" "}
                </span>
                {note.text}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {warnings.length > 0 ? (
        <section
          aria-label="Continuity notes"
          className="rounded-md border border-border/70 bg-card/30 p-4"
        >
          <h3 className="cue text-[0.55rem] text-muted-foreground">
            Continuity notes · {warnings.length}
          </h3>
          <ul className="mt-2 space-y-1.5">
            {warnings.map((warning) => (
              <li key={warning._id} className="text-xs leading-relaxed text-foreground/85">
                <span className="text-muted-foreground">
                  [{warning.severity}
                  {warning.status !== "open" ? ` · ${warning.status}` : ""}]{" "}
                </span>
                {warning.text}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
