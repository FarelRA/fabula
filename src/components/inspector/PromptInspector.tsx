"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ChevronRightIcon, FileSearchIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SnapshotDetailView } from "./types";

/**
 * Prompt inspector (PLAN §7.7, Phase 6.6): block-by-block compiled text,
 * template versions, hashes, token counts and budget actions for any
 * generation. Snapshots store rendered block text at write time, so the view
 * stays truthful even after templates or role revisions change.
 */
export function PromptInspector({
  snapshots,
  contextLabel,
}: {
  snapshots: SnapshotDetailView[];
  contextLabel?: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    snapshots[0]?.id ?? null,
  );

  useEffect(() => {
    setSelectedId((current) => {
      if (current && snapshots.some((snapshot) => snapshot.id === current)) {
        return current;
      }
      return snapshots[0]?.id ?? null;
    });
  }, [snapshots]);

  if (snapshots.length === 0) {
    return (
      <div data-testid="prompt-inspector" className="space-y-2">
        <p className="text-xs text-muted-foreground">
          {contextLabel
            ? `No compiled snapshot for ${contextLabel} yet.`
            : "No generations recorded yet."}
        </p>
      </div>
    );
  }

  const selected =
    snapshots.find((snapshot) => snapshot.id === selectedId) ?? snapshots[0];

  return (
    <div data-testid="prompt-inspector" className="space-y-3">
      <div className="flex items-center gap-1.5">
        <FileSearchIcon className="size-3.5 text-muted-foreground" aria-hidden />
        <h3 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          {contextLabel ? `Prompts · ${contextLabel}` : "Recent generations"}
        </h3>
      </div>

      {snapshots.length > 1 ? (
        <ul className="flex flex-wrap gap-1" aria-label="Generations">
          {snapshots.map((snapshot) => (
            <li key={snapshot.id}>
              <button
                type="button"
                onClick={() => setSelectedId(snapshot.id)}
                aria-pressed={snapshot.id === selected?.id}
                className={`rounded-full border px-2 py-0.5 text-[10px] ${
                  snapshot.id === selected?.id
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {snapshot.mode} · {formatDistanceToNow(snapshot.createdAt, { addSuffix: true })}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {selected ? (
        <div className="space-y-2">
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg border border-border bg-card/60 p-2.5 text-[11px]">
            <div>
              <dt className="text-muted-foreground">Mode</dt>
              <dd className="font-medium">{selected.mode}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Model</dt>
              <dd className="truncate font-medium" title={`${selected.model.provider}/${selected.model.modelId}`}>
                {selected.model.provider}/{selected.model.modelId}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Tokens</dt>
              <dd className="font-medium">
                {selected.tokenCounts.total} total · {selected.tokenCounts.system} system ·{" "}
                {selected.tokenCounts.context} context
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Context window</dt>
              <dd className="font-medium">
                {selected.tokenCounts.total}/{selected.budget.contextWindow} ·{" "}
                {selected.budget.systemTargetPct}% system target
              </dd>
            </div>
            {selected.budget.overBudgetAction ? (
              <div className="col-span-2">
                <Badge variant="outline" className="font-normal text-amber-600 dark:text-amber-300">
                  Budget action: {selected.budget.overBudgetAction}
                </Badge>
              </div>
            ) : null}
          </dl>

          <ul className="space-y-1.5">
            {selected.blocks.map((block) => (
              <li key={`${selected.id}:${block.key}`}>
                <details
                  data-testid="prompt-block"
                  data-block-key={block.key}
                  className="group rounded-lg border border-border bg-background/60"
                >
                  <summary className="flex cursor-pointer list-none items-center gap-1.5 px-2.5 py-2 text-xs">
                    <ChevronRightIcon
                      aria-hidden
                      className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
                    />
                    <span className="font-medium uppercase tracking-wide">
                      {block.key}
                    </span>
                    {block.templateKey ? (
                      <Badge variant="outline" className="font-normal">
                        {block.templateKey}
                        {block.templateVersion !== undefined
                          ? ` v${block.templateVersion}`
                          : ""}
                      </Badge>
                    ) : null}
                    <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                      {block.tokens} tok · {block.chars} ch ·{" "}
                      <code title={block.hash}>{block.hash.slice(0, 8)}</code>
                    </span>
                  </summary>
                  <pre className="max-h-72 overflow-auto border-t border-border px-2.5 py-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                    {block.text}
                  </pre>
                </details>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
