"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRightIcon,
  LoaderCircleIcon,
  PenLineIcon,
  SparklesIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import type { OpeningDraft } from "@/lib/cast/types";

/**
 * Opening beat step: preview/regenerate/write-your-own, then
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
    <Surface tone="raised" padding="none" className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-5 py-3">
        <span className="size-1.5 rounded-full bg-primary" aria-hidden />
        <p className="cue text-[0.6rem] text-primary">The first cue</p>
        <h2 id="opening-heading" className="ml-1 font-serif text-lg leading-tight">
          Opening beat
        </h2>
        {draft ? <Badge variant="secondary">Draft</Badge> : null}
        {draft ? (
          <span className="font-mono text-[10px] text-muted-foreground">
            reroll {draft.variant + 1}
          </span>
        ) : null}
        <span className="ml-auto hidden font-mono text-[10px] text-muted-foreground sm:inline">
          Nothing is canon until you start
        </span>
      </div>

      <div className="p-5 sm:p-6">
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Set the stage. Generate it, reroll until it lands, or write the first
          line yourself. The cast will take it from there.
        </p>

        {drafting && !draft ? (
          <div className="mt-4 space-y-2 rounded-md border border-border/60 bg-background/25 p-4" role="status" aria-live="polite">
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
            className="mt-4 min-h-32 border-border/60 bg-background/30 font-serif text-lg leading-relaxed"
          />
        )}

        {error ? (
          <p role="alert" className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
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
            <span className="font-mono text-[10px] text-muted-foreground" aria-live="polite">
              {text.trim().split(/\s+/).filter(Boolean).length} words
            </span>
            <Button
              type="button"
              size="lg"
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
      </div>
    </Surface>
  );
}
