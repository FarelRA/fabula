"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRightIcon, LoaderCircleIcon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AuditionScreen } from "@/components/cast/AuditionScreen";
import { CastProgress } from "@/components/cast/CastProgress";
import { CastSizeStepper } from "@/components/cast/CastSizeStepper";
import { ToneDials } from "@/components/cast/ToneDials";
import { useCastSession } from "@/lib/cast/sessionContext";
import {
  DEFAULT_VALUES,
  newSceneSchema,
  sceneInputFrom,
  type NewSceneValues,
} from "@/lib/cast/wizard";

const EXAMPLES = [
  "A debt collector knocks on the wrong door in 1970s Saigon.",
  "The old king is dying and every smile at court hides a knife.",
  "A salvage crew wakes something in the hold of an abandoned freighter.",
];

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Quick start (PLAN §9.3, E2E-01): one line → cast + opening → audition-lite →
 * play. This component is screen 1; the session flips it to screen 2 while
 * casting, and the same route holds the audition.
 */
export function QuickStartForm({ onCreated }: { onCreated?: (sceneId: string) => void }) {
  const session = useCastSession();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<NewSceneValues>({
    resolver: zodResolver(newSceneSchema),
    defaultValues: { ...DEFAULT_VALUES, tone: { ...DEFAULT_VALUES.tone } },
  });
  const playAs = form.watch("playAs");

  if (session.busy.casting) {
    return <CastProgress label="Casting the troupe and setting the stage…" />;
  }

  if (session.scene) {
    return <AuditionScreen compact />;
  }

  const submit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const sceneId = await session.createScene(sceneInputFrom(values));
      onCreated?.(sceneId);
    } catch (error) {
      setSubmitError(messageOf(error));
    }
  });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="mb-2 text-xs font-medium tracking-[0.2em] text-primary uppercase">
        Quick start
      </p>
      <h1 className="font-serif text-3xl leading-tight sm:text-4xl">
        Give me one line.
        <br />
        I&apos;ll cast it and start the scene.
      </h1>
      <p className="mt-3 max-w-prose text-sm text-muted-foreground">
        No account, no setup wizard. The casting pass writes a coherent troupe,
        then you can edit anyone before the first beat.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-6" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="quick-premise">Premise</Label>
          <Textarea
            id="quick-premise"
            rows={4}
            placeholder="A debt collector knocks on the wrong door in 1970s Saigon."
            aria-invalid={Boolean(form.formState.errors.premise)}
            aria-describedby="quick-premise-error"
            autoFocus
            {...form.register("premise")}
          />
          {form.formState.errors.premise ? (
            <p id="quick-premise-error" className="text-xs text-destructive">
              {form.formState.errors.premise.message}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => form.setValue("premise", example, { shouldValidate: true })}
                className="rounded-full border border-border px-2.5 py-1 text-left text-xs text-muted-foreground hover:bg-muted"
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Tone</Label>
          <Controller
            control={form.control}
            name="tone"
            render={({ field }) => <ToneDials value={field.value} onChange={field.onChange} />}
          />
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">I&apos;ll play</legend>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" value="director" {...form.register("playAs")} />
              Director from the wings
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" value="role" {...form.register("playAs")} />
              A role in the scene
            </label>
          </div>
          {playAs === "role" ? (
            <div className="grid gap-3 pt-1 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="quick-your-name">Your character&apos;s name</Label>
                <Input
                  id="quick-your-name"
                  placeholder="e.g. Linh"
                  {...form.register("yourName")}
                />
                {form.formState.errors.yourName ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.yourName.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quick-your-pronouns">Pronouns (optional)</Label>
                <Input
                  id="quick-your-pronouns"
                  placeholder="she/her"
                  {...form.register("yourPronouns")}
                />
              </div>
            </div>
          ) : null}
        </fieldset>

        <div className="space-y-2">
          <Label>Cast size</Label>
          <Controller
            control={form.control}
            name="castSize"
            render={({ field }) => (
              <CastSizeStepper
                value={field.value}
                onChange={field.onChange}
                showTierPreview
              />
            )}
          />
        </div>

        <details className="rounded-xl border border-border bg-card p-3">
          <summary className="cursor-pointer text-sm font-medium">
            More options: genre, era, style, boundaries
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="quick-genre">Genre</Label>
              <Input id="quick-genre" {...form.register("genre")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quick-era">Setting / era</Label>
              <Input id="quick-era" {...form.register("settingEra")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quick-style">Presentation</Label>
              <select
                id="quick-style"
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
                {...form.register("presentationStyle")}
              >
                <option value="chat">Chat — Name: line</option>
                <option value="script">Script — NAME / stage directions</option>
                <option value="novel">Novel — third person prose</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quick-blocked">Content to avoid (comma separated)</Label>
              <Input id="quick-blocked" {...form.register("blockedText")} />
            </div>
          </div>
        </details>

        {submitError ? (
          <p role="alert" className="text-sm text-destructive">
            {submitError}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? (
              <LoaderCircleIcon className="animate-spin motion-reduce:animate-none" />
            ) : (
              <SparklesIcon />
            )}
            Cast &amp; play
            <ArrowRightIcon />
          </Button>
          <span className="text-xs text-muted-foreground">
            Casting runs in the background; the audition stays editable.
          </span>
        </div>
      </form>
    </div>
  );
}
