"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRightIcon, LoaderCircleIcon, PenLineIcon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { OpeningDraft } from "@/lib/cast/types";

/**
 * Opening beat step (PLAN Phase 4.6): preview/regenerate/write-your-own, then
 * Start. Nothing is canon until Start; the committed text is exactly what the
 * director sees here. All three paths land in the same scene page.
 */
export function OpeningStep({
  draft,
  drafting,
  starting,
  error,
  onGenerate,
  onStart,
}: {
  draft: OpeningDraft | null;
  drafting: boolean;
  starting: boolean;
  error?: string | null;
  onGenerate: () => void;
  onStart: (text: string) => void;
}) {
  const [text, setText] = useState(draft?.text ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (draft) setText(draft.text);
  }, [draft?.text, draft?.variant, draft]);

  const canStart = text.trim().length > 0 && !drafting && !starting;

  return (
    <section
      aria-labelledby="opening-heading"
      className="space-y-3 rounded-xl border border-border bg-card p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="opening-heading" className="font-heading text-base font-semibold">
          Opening beat
        </h2>
        {draft ? <Badge variant="secondary">Draft</Badge> : null}
        {draft ? (
          <span className="text-xs text-muted-foreground">reroll {draft.variant + 1}</span>
        ) : null}
      </div>
      <p className="max-w-prose text-sm text-muted-foreground">
        Set the stage. Generate it, reroll until it lands, or write the first
        line yourself — nothing is canon until you press Start.
      </p>

      {drafting && !draft ? (
        <div className="space-y-2" role="status" aria-live="polite">
          <span className="sr-only">Generating the opening beat…</span>
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : (
        <Textarea
          ref={textareaRef}
          aria-label="Opening beat"
          value={text}
          rows={5}
          placeholder="Or write the opening line yourself…"
          onChange={(event) => setText(event.target.value)}
          className="font-serif text-base leading-relaxed"
        />
      )}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onGenerate}
          disabled={drafting || starting}
        >
          {drafting ? (
            <LoaderCircleIcon className="animate-spin motion-reduce:animate-none" />
          ) : (
            <SparklesIcon />
          )}
          {draft ? "Regenerate" : "Generate opening"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            textareaRef.current?.focus();
          }}
          disabled={drafting || starting}
        >
          <PenLineIcon />
          Write it myself
        </Button>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {text.trim().split(/\s+/).filter(Boolean).length} words
          </span>
          <Button
            type="button"
            disabled={!canStart}
            onClick={() => onStart(text)}
          >
            {starting ? (
              <LoaderCircleIcon className="animate-spin motion-reduce:animate-none" />
            ) : null}
            Start scene
            <ArrowRightIcon />
          </Button>
        </div>
      </div>
    </section>
  );
}
