"use client";

import { useState } from "react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  LoaderCircleIcon,
  PenLineIcon,
  SparklesIcon,
  UsersIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Surface } from "@/components/ui/surface";
import { Textarea } from "@/components/ui/textarea";
import { AuditionScreen } from "@/components/cast/AuditionScreen";
import { CastProgress } from "@/components/cast/CastProgress";
import { CastSizeStepper } from "@/components/cast/CastSizeStepper";
import { ToneDials } from "@/components/cast/ToneDials";
import { Wordmark } from "@/components/brand/Wordmark";
import { useCastSession } from "@/lib/cast/sessionContext";
import {
  DEFAULT_VALUES,
  newSceneSchema,
  sceneInputFrom,
  type NewSceneValues,
} from "@/lib/cast/wizard";
import { cn } from "cn";

const EXAMPLES = [
  "A debt collector knocks on the wrong door in 1970s Saigon.",
  "The old king is dying and every smile at court hides a knife.",
  "A salvage crew wakes something in the hold of an abandoned freighter.",
];

const STEPS = [
  {
    title: "The troupe arrives",
    copy: "A coherent cast is written for this premise, each with a voice, a secret and a reason to be in the room.",
  },
  {
    title: "You meet them",
    copy: "Edit a hook, lock a voice, regenerate a role, or hear a sample line before anyone steps on stage.",
  },
  {
    title: "The curtain rises",
    copy: "An opening beat is drafted. You can keep it, reroll it, or write the first line yourself.",
  },
];

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Quick start: one line → cast + opening → audition-lite →
 * play. This component is the premise screen; the session flips it to the
 * audition while casting, and the same route holds both.
 */
export function QuickStartForm({ onCreated }: { onCreated?: (sceneId: string) => void }) {
  const session = useCastSession();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<NewSceneValues>({
    resolver: zodResolver(newSceneSchema),
    defaultValues: { ...DEFAULT_VALUES, tone: { ...DEFAULT_VALUES.tone } },
  });
  const playAs = form.watch("playAs");
  const premise = form.watch("premise");

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
    <div className="stage-haze min-h-dvh">
      <div className="studio-shell py-10 sm:py-14">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/new"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            ← Back to the three doors
          </Link>
          <Wordmark className="shrink-0" />
        </div>

        <header className="mt-6 max-w-3xl">
          <p className="cue text-primary">Door 01 · Quick start</p>
          <h1 className="mt-3 font-serif text-4xl leading-[1.04] tracking-[-0.025em] text-balance sm:text-5xl">
            Give me one line.
            <span className="block italic text-primary">I&apos;ll cast it and start the scene.</span>
          </h1>
          <p className="mt-4 max-w-2xl font-serif text-base leading-relaxed text-muted-foreground sm:text-lg">
            No setup wizard, no account. The casting pass writes a coherent
            troupe, an opening beat, and a room you can edit before the first
            cue.
          </p>
        </header>

        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Surface tone="raised" padding="none" className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-border/70 px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-primary" aria-hidden />
                <p className="cue text-[0.6rem] text-muted-foreground">Inciting incident</p>
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">
                1 / 3 · Premise
              </span>
            </div>

            <form onSubmit={submit} className="space-y-7 p-5 sm:p-6" noValidate>
              <div className="space-y-2">
                <Label htmlFor="quick-premise" className="font-sans text-sm font-semibold">
                  Premise
                </Label>
                <Textarea
                  id="quick-premise"
                  rows={5}
                  placeholder="A debt collector knocks on the wrong door in 1970s Saigon."
                  aria-invalid={Boolean(form.formState.errors.premise)}
                  aria-describedby="quick-premise-error"
                  autoFocus
                  className="min-h-32 font-serif text-lg leading-relaxed"
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
                      className="rounded-sm border border-border/70 bg-background/25 px-2 py-1 text-left text-[11px] leading-snug text-muted-foreground transition-colors hover:border-primary/35 hover:text-foreground"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 border-t border-border/60 pt-5">
                <div className="flex items-center justify-between">
                  <Label className="font-sans text-sm font-semibold">Tone</Label>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    optional · adjust later
                  </span>
                </div>
                <Controller
                  control={form.control}
                  name="tone"
                  render={({ field }) => <ToneDials value={field.value} onChange={field.onChange} />}
                />
              </div>

              <fieldset className="space-y-2 border-t border-border/60 pt-5">
                <legend className="font-sans text-sm font-semibold">I&apos;ll play</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors",
                      playAs === "director"
                        ? "border-primary/45 bg-primary/5"
                        : "border-border/70 bg-background/20 hover:border-primary/25",
                    )}
                  >
                    <input type="radio" value="director" className="sr-only" {...form.register("playAs")} />
                    <span
                      className={cn(
                        "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                        playAs === "director" ? "border-primary" : "border-border",
                      )}
                      aria-hidden
                    >
                      {playAs === "director" ? <span className="size-2 rounded-full bg-primary" /> : null}
                    </span>
                    <span>
                      <span className="block text-sm font-medium">Director from the wings</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                        Shape the scene with paths and notes. The cast carries every voice.
                      </span>
                    </span>
                  </label>
                  <label
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors",
                      playAs === "role"
                        ? "border-primary/45 bg-primary/5"
                        : "border-border/70 bg-background/20 hover:border-primary/25",
                    )}
                  >
                    <input type="radio" value="role" className="sr-only" {...form.register("playAs")} />
                    <span
                      className={cn(
                        "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                        playAs === "role" ? "border-primary" : "border-border",
                      )}
                      aria-hidden
                    >
                      {playAs === "role" ? <span className="size-2 rounded-full bg-primary" /> : null}
                    </span>
                    <span>
                      <span className="block text-sm font-medium">A role in the scene</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                        The casting pass writes you in. Step into the spotlight when you choose.
                      </span>
                    </span>
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

              <div className="space-y-2 border-t border-border/60 pt-5">
                <div className="flex items-center justify-between">
                  <Label>Cast size</Label>
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <UsersIcon className="size-3.5" aria-hidden />
                    2–4 recommended
                  </span>
                </div>
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

              <details className="group rounded-md border border-border/70 bg-background/20 p-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium">
                  <span>More options: genre, era, style, boundaries</span>
                  <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
                      className="h-9 w-full rounded-md border border-input bg-background/35 px-3 text-sm focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/15"
                      {...form.register("presentationStyle")}
                    >
                      <option value="chat">Chat. Name: line</option>
                      <option value="script">Script. NAME / stage directions</option>
                      <option value="novel">Novel, third person prose</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="quick-blocked">Content to avoid (comma separated)</Label>
                    <Input id="quick-blocked" {...form.register("blockedText")} />
                  </div>
                </div>
              </details>

              {submitError ? (
                <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {submitError}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-5">
                <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? (
                    <LoaderCircleIcon className="animate-spin motion-reduce:animate-none" />
                  ) : (
                    <SparklesIcon />
                  )}
                  Cast &amp; play
                  <ArrowRightIcon />
                </Button>
                <span className="text-xs leading-relaxed text-muted-foreground">
                  Casting runs in the background; the audition stays editable.
                </span>
              </div>
            </form>
          </Surface>

          <aside className="space-y-4 lg:sticky lg:top-8">
            <Surface tone="recessed" padding="md">
              <p className="cue text-primary">What happens next</p>
              <ol className="mt-3 space-y-3">
                {STEPS.map((step, index) => (
                  <li key={step.title} className="flex gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-sm border border-border bg-card/60 font-mono text-[10px] text-primary">
                      0{index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{step.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        {step.copy}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </Surface>

            <Surface tone="flat" padding="md">
              <p className="cue text-muted-foreground">The director&apos;s controls</p>
              <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                {[
                  "Every role card is editable before play",
                  "Lock what you love; regenerate the rest",
                  "The opening beat is never canon until you start",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </Surface>

            {premise?.trim() ? (
              <Surface tone="flat" padding="md" className="border-primary/20 bg-primary/5">
                <p className="cue text-primary">Your opening line</p>
                <p className="mt-2 font-serif text-lg leading-snug italic text-foreground/90">
                  “{premise.trim()}”
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <PenLineIcon className="size-3.5" aria-hidden />
                  This is enough to cast a room.
                </p>
              </Surface>
            ) : (
              <Surface tone="flat" padding="md" className="border-dashed">
                <p className="cue text-muted-foreground">No line yet</p>
                <p className="mt-2 font-serif text-lg leading-snug italic text-muted-foreground">
                  “A door opens onto a room that should not exist.”
                </p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Anything with a person, a place and a pressure will do.
                </p>
              </Surface>
            )}

            <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
              Want more control?{" "}
              <Link href="/new/wizard" className="font-medium text-primary hover:underline">
                Use guided setup
              </Link>{" "}
              or begin from a{" "}
              <Link href="/new/templates" className="font-medium text-primary hover:underline">
                curated world
              </Link>
              .
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
