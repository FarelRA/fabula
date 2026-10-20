"use client";

import { useState } from "react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  LoaderCircleIcon,
  SparklesIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { presetById, toneSummary } from "@/lib/cast/presets";
import {
  NEW_SCENE_STEPS,
  STEP_FIELDS,
  newSceneSchema,
  sceneInputFrom,
  valuesFromPreset,
  type NewSceneStep,
  type NewSceneValues,
} from "@/lib/cast/wizard";
import { cn } from "cn";

const STEP_LABELS: Record<Exclude<NewSceneStep, "audition">, string> = {
  premise: "Premise",
  world: "World & tone",
  you: "You in scene",
  cast: "Cast size",
};

const EXAMPLE_PREMISES = [
  "A rain-soaked precinct, 1948. A detective has one night to break an alibi.",
  "Two rival columnists in 1920s Paris are secretly each other's confessor.",
  "A tavern at the crossroads where every traveler owes someone something.",
];

const STYLE_LABELS: Record<string, string> = {
  chat: "Chat · Name: line",
  script: "Script · stage directions",
  novel: "Novel · prose",
};

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Guided wizard: four validated steps, then the same audition component as
 * quick start and templates. The URL owns the step (nuqs at the route); this
 * component stays pure/testable via props.
 */
export function WizardFlow({
  step,
  initialTemplateId,
  onStepChange,
  onCreated,
}: {
  step: NewSceneStep;
  initialTemplateId?: string;
  onStepChange: (step: NewSceneStep) => void;
  onCreated: (sceneId: string) => void;
}) {
  const session = useCastSession();
  const preset = presetById(initialTemplateId);
  const [castError, setCastError] = useState<string | null>(null);
  const form = useForm<NewSceneValues>({
    resolver: zodResolver(newSceneSchema),
    defaultValues: valuesFromPreset(preset),
  });
  const playAs = form.watch("playAs");
  const values = form.watch();

  if (session.busy.casting) {
    return <CastProgress label="Generating the cast, then setting the first beat…" />;
  }
  if (session.scene) {
    return <AuditionScreen />;
  }

  const stepIndex = NEW_SCENE_STEPS.indexOf(step);
  const numericStep =
    step === "audition" ? 3 : Math.max(0, Math.min(3, stepIndex));
  const currentStep = NEW_SCENE_STEPS[numericStep] as Exclude<NewSceneStep, "audition">;

  async function next(): Promise<void> {
    const fields = STEP_FIELDS[currentStep];
    const valid = await form.trigger(fields);
    if (!valid) return;
    const target = NEW_SCENE_STEPS[numericStep + 1] ?? "audition";
    onStepChange(target);
  }

  function back(): void {
    const target = numericStep === 0 ? "premise" : NEW_SCENE_STEPS[numericStep - 1];
    if (target) onStepChange(target);
  }

  const generate = form.handleSubmit(async (formValues) => {
    setCastError(null);
    try {
      const sceneId = await session.createScene(
        sceneInputFrom(formValues, initialTemplateId),
      );
      onCreated(sceneId);
    } catch (error) {
      setCastError(messageOf(error));
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
          <div className="flex flex-wrap items-center gap-2">
            <p className="cue text-primary">Door 02 · Guided setup</p>
            {preset ? (
              <Badge variant="outline" className="border-primary/30 text-primary">
                Template: {preset.name}
              </Badge>
            ) : null}
          </div>
          <h1 className="mt-3 font-serif text-4xl leading-[1.05] tracking-[-0.025em] text-balance sm:text-5xl">
            Build the room before
            <span className="block italic text-primary">the cast walks in.</span>
          </h1>
          <p className="mt-4 max-w-2xl font-serif text-base leading-relaxed text-muted-foreground sm:text-lg">
            Four short decisions: the premise, the weather of the world, whether
            you are in the scene, and how many voices you want. Nothing is
            generated until the final cue.
          </p>
        </header>

        <ol className="mt-8 grid gap-2 sm:grid-cols-4" aria-label="Setup steps">
          {(Object.keys(STEP_LABELS) as Array<keyof typeof STEP_LABELS>).map((key, index) => {
            const state =
              index === numericStep ? "current" : index < numericStep ? "done" : "upcoming";
            return (
              <li key={key}>
                <div
                  aria-current={state === "current" ? "step" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md border px-3 py-2.5 transition-colors",
                    state === "current" && "border-primary/40 bg-primary/8",
                    state === "done" && "border-primary/20 bg-primary/4",
                    state === "upcoming" && "border-border/60 bg-card/30",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-sm border font-mono text-[10px]",
                      state === "current"
                        ? "border-primary/40 bg-primary text-primary-foreground"
                        : state === "done"
                          ? "border-primary/30 text-primary"
                          : "border-border/70 text-muted-foreground",
                    )}
                  >
                    {state === "done" ? <CheckIcon className="size-3" aria-hidden /> : `0${index + 1}`}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={cn(
                        "block truncate text-xs font-medium",
                        state === "upcoming" ? "text-muted-foreground" : "text-foreground",
                      )}
                    >
                      {STEP_LABELS[key]}
                    </span>
                    {index === numericStep ? (
                      <span className="block text-[10px] text-primary">In progress</span>
                    ) : null}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (currentStep === "cast") void generate();
            else void next();
          }}
          className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]"
          noValidate
        >
          <Surface tone="raised" padding="none" className="overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-border/70 px-5 py-3">
              <p className="cue text-[0.6rem] text-muted-foreground">
                {STEP_LABELS[currentStep]}
              </p>
              <span className="font-mono text-[10px] text-muted-foreground">
                Step {numericStep + 1} of 4
              </span>
            </div>

            <div className="space-y-6 p-5 sm:p-6">
              {currentStep === "premise" ? (
                <section aria-labelledby="wizard-premise" className="space-y-2">
                  <div className="space-y-1">
                    <h2 id="wizard-premise" className="font-serif text-2xl leading-tight">
                      What is the story?
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Give the room a pressure, a person, and a place. One good
                      sentence is enough.
                    </p>
                  </div>
                  <Label htmlFor="wizard-premise-input">Premise</Label>
                  <Textarea
                    id="wizard-premise-input"
                    rows={6}
                    placeholder="A debt collector knocks on the wrong door…"
                    aria-invalid={Boolean(form.formState.errors.premise)}
                    className="min-h-36 font-serif text-lg leading-relaxed"
                    {...form.register("premise")}
                  />
                  {form.formState.errors.premise ? (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.premise.message}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {EXAMPLE_PREMISES.map((example) => (
                      <button
                        key={example}
                        type="button"
                        className="rounded-sm border border-border/70 bg-background/25 px-2 py-1 text-left text-[11px] leading-snug text-muted-foreground transition-colors hover:border-primary/35 hover:text-foreground"
                        onClick={() =>
                          form.setValue("premise", example, { shouldValidate: true })
                        }
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              {currentStep === "world" ? (
                <section aria-labelledby="wizard-world" className="space-y-4">
                  <div className="space-y-1">
                    <h2 id="wizard-world" className="font-serif text-2xl leading-tight">
                      World &amp; tone
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      The genre and era set the vocabulary; the dials set the
                      temperature.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="wizard-genre">Genre</Label>
                      <Input id="wizard-genre" {...form.register("genre")} />
                      {form.formState.errors.genre ? (
                        <p className="text-xs text-destructive">
                          {form.formState.errors.genre.message}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="wizard-era">Setting / era</Label>
                      <Input id="wizard-era" {...form.register("settingEra")} />
                      {form.formState.errors.settingEra ? (
                        <p className="text-xs text-destructive">
                          {form.formState.errors.settingEra.message}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="wizard-style">Presentation</Label>
                      <select
                        id="wizard-style"
                        className="h-9 w-full rounded-md border border-input bg-background/35 px-3 text-sm focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/15"
                        {...form.register("presentationStyle")}
                      >
                        <option value="chat">Chat. Name: line</option>
                        <option value="script">Script. NAME / stage directions</option>
                        <option value="novel">Novel, third person prose</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="wizard-language">Play language</Label>
                      <Input id="wizard-language" {...form.register("playLanguage")} />
                      {form.formState.errors.playLanguage ? (
                        <p className="text-xs text-destructive">
                          {form.formState.errors.playLanguage.message}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="space-y-2 border-t border-border/60 pt-4">
                    <Label>Tone</Label>
                    <Controller
                      control={form.control}
                      name="tone"
                      render={({ field }) => (
                        <ToneDials value={field.value} onChange={field.onChange} />
                      )}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="wizard-blocked">Content to avoid (comma separated)</Label>
                    <Input id="wizard-blocked" {...form.register("blockedText")} />
                  </div>
                </section>
              ) : null}

              {currentStep === "you" ? (
                <section aria-labelledby="wizard-you" className="space-y-4">
                  <div className="space-y-1">
                    <h2 id="wizard-you" className="font-serif text-2xl leading-tight">
                      Are you in the scene?
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Either way, you can write a line as any role later.
                    </p>
                  </div>
                  <fieldset className="space-y-2">
                    <legend className="sr-only">I&apos;ll play</legend>
                    <label
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm transition-colors",
                        playAs === "director"
                          ? "border-primary/45 bg-primary/5"
                          : "border-border/70 bg-background/20 hover:border-primary/25",
                      )}
                    >
                      <input
                        type="radio"
                        value="director"
                        className="mt-1"
                        {...form.register("playAs")}
                      />
                      <span>
                        <span className="font-medium">Director from the wings</span>
                        <span className="block text-xs text-muted-foreground">
                          The whole cast is AI. You steer, pick paths, and can still
                          write a line as anyone.
                        </span>
                      </span>
                    </label>
                    <label
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm transition-colors",
                        playAs === "role"
                          ? "border-primary/45 bg-primary/5"
                          : "border-border/70 bg-background/20 hover:border-primary/25",
                      )}
                    >
                      <input
                        type="radio"
                        value="role"
                        className="mt-1"
                        {...form.register("playAs")}
                      />
                      <span>
                        <span className="font-medium">A role in the scene</span>
                        <span className="block text-xs text-muted-foreground">
                          We generate your card with the same editor as the AI cast.
                        </span>
                      </span>
                    </label>
                  </fieldset>
                  {playAs === "role" ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="wizard-your-name">Your character&apos;s name</Label>
                        <Input id="wizard-your-name" {...form.register("yourName")} />
                        {form.formState.errors.yourName ? (
                          <p className="text-xs text-destructive">
                            {form.formState.errors.yourName.message}
                          </p>
                        ) : null}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="wizard-your-pronouns">Pronouns (optional)</Label>
                        <Input id="wizard-your-pronouns" {...form.register("yourPronouns")} />
                      </div>
                    </div>
                  ) : null}
                </section>
              ) : null}

              {currentStep === "cast" ? (
                <section aria-labelledby="wizard-cast" className="space-y-4">
                  <div className="space-y-1">
                    <h2 id="wizard-cast" className="font-serif text-2xl leading-tight">
                      How many voices?
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Two to four keeps the floor lively. More roles mean more
                      cutting between voices and a longer runway.
                    </p>
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
                  <div className="rounded-md border border-border/70 bg-background/25 p-3 text-sm">
                    <p className="font-medium">
                      {values.castSize} AI {values.castSize === 1 ? "role" : "roles"}
                      {values.playAs === "role" ? " + you" : ""} · {values.presentationStyle}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {values.premise}
                    </p>
                  </div>
                  {castError ? (
                    <p role="alert" className="text-sm text-destructive">
                      {castError}
                    </p>
                  ) : null}
                </section>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-border/70 px-5 py-4">
              <Button
                type="button"
                variant="ghost"
                onClick={back}
                disabled={numericStep === 0 && currentStep === "premise"}
              >
                <ArrowLeftIcon />
                Back
              </Button>
              <div className="ml-auto flex items-center gap-2">
                <span className="hidden font-mono text-[10px] text-muted-foreground sm:inline">
                  Step {numericStep + 1} of 4
                </span>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? (
                    <LoaderCircleIcon className="animate-spin motion-reduce:animate-none" />
                  ) : null}
                  {currentStep === "cast" ? (
                    <>
                      <SparklesIcon />
                      Generate cast
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRightIcon />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Surface>

          <aside className="space-y-4 lg:sticky lg:top-8">
            <Surface tone="recessed" padding="md">
              <p className="cue text-primary">The room so far</p>
              <p className="mt-3 font-serif text-lg leading-snug italic text-foreground/90">
                {values.premise?.trim()
                  ? `“${values.premise.trim()}”`
                  : "A room, a pressure, a person. The premise will appear here."}
              </p>
              <dl className="mt-4 space-y-2 border-t border-border/60 pt-3 text-xs">
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">World</dt>
                  <dd className="text-right font-medium text-foreground">
                    {values.genre || "Unset"} · {values.settingEra || "Unset"}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">Tone</dt>
                  <dd className="text-right font-medium text-foreground">
                    {toneSummary(values.tone)}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">Style</dt>
                  <dd className="text-right font-medium text-foreground">
                    {STYLE_LABELS[values.presentationStyle] ?? values.presentationStyle}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">Cast</dt>
                  <dd className="text-right font-medium text-foreground">
                    {values.castSize} AI {values.castSize === 1 ? "voice" : "voices"}
                    {values.playAs === "role" ? " + you" : ""}
                  </dd>
                </div>
              </dl>
              {preset ? (
                <p className="mt-3 border-t border-border/60 pt-3 text-[11px] leading-relaxed text-muted-foreground">
                  Seeded from <span className="text-foreground">{preset.name}</span>. Every
                  card remains editable in the audition.
                </p>
              ) : null}
            </Surface>

            <Surface tone="flat" padding="md">
              <p className="cue text-muted-foreground">Good to know</p>
              <ul className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground">
                <li className="flex gap-2">
                  <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                  You can skip any step and edit every role later.
                </li>
                <li className="flex gap-2">
                  <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                  The opening beat is never canon until you press Start.
                </li>
                <li className="flex gap-2">
                  <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                  No account is needed to reach the stage.
                </li>
              </ul>
            </Surface>
          </aside>
        </form>
      </div>
    </div>
  );
}
