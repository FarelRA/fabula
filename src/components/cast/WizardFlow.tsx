"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeftIcon, ArrowRightIcon, LoaderCircleIcon, SparklesIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AuditionScreen } from "@/components/cast/AuditionScreen";
import { CastProgress } from "@/components/cast/CastProgress";
import { CastSizeStepper } from "@/components/cast/CastSizeStepper";
import { ToneDials } from "@/components/cast/ToneDials";
import { useCastSession } from "@/lib/cast/sessionContext";
import { presetById } from "@/lib/cast/presets";
import {
  NEW_SCENE_STEPS,
  STEP_FIELDS,
  newSceneSchema,
  sceneInputFrom,
  valuesFromPreset,
  type NewSceneStep,
  type NewSceneValues,
} from "@/lib/cast/wizard";

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

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Guided wizard: four validated steps, then the same
 * audition component as quick start and templates. The URL owns the step
 * (nuqs at the route); this component stays pure/testable via props.
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
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-medium tracking-[0.2em] text-primary uppercase">
          Guided setup
        </p>
        {preset ? <Badge variant="secondary">Template: {preset.name}</Badge> : null}
      </div>
      <h1 className="mt-2 font-serif text-3xl leading-tight">
        Build the room before the cast walks in.
      </h1>

      <ol className="mt-6 flex flex-wrap gap-2" aria-label="Setup steps">
        {(Object.keys(STEP_LABELS) as Array<keyof typeof STEP_LABELS>).map((key, index) => {
          const state =
            index === numericStep ? "current" : index < numericStep ? "done" : "upcoming";
          return (
            <li key={key}>
              <span
                aria-current={state === "current" ? "step" : undefined}
                className={
                  state === "current"
                    ? "inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
                    : state === "done"
                      ? "inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs text-primary"
                      : "inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
                }
              >
                <span aria-hidden>{index + 1}</span>
                {STEP_LABELS[key]}
              </span>
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
        className="mt-6 space-y-5"
        noValidate
      >
        {currentStep === "premise" ? (
          <section aria-labelledby="wizard-premise" className="space-y-2">
            <h2 id="wizard-premise" className="font-heading text-lg font-semibold">
              What is the story?
            </h2>
            <Label htmlFor="wizard-premise-input">Premise</Label>
            <Textarea
              id="wizard-premise-input"
              rows={5}
              placeholder="A debt collector knocks on the wrong door…"
              aria-invalid={Boolean(form.formState.errors.premise)}
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
                  className="rounded-full border border-border px-2.5 py-1 text-left text-xs text-muted-foreground hover:bg-muted"
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
          <section aria-labelledby="wizard-world" className="space-y-3">
            <h2 id="wizard-world" className="font-heading text-lg font-semibold">
              World & tone
            </h2>
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
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
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
            <div className="space-y-2">
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
          <section aria-labelledby="wizard-you" className="space-y-3">
            <h2 id="wizard-you" className="font-heading text-lg font-semibold">
              Are you in the scene?
            </h2>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">I&apos;ll play</legend>
              <label className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm">
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
              <label className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm">
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
          <section aria-labelledby="wizard-cast" className="space-y-3">
            <h2 id="wizard-cast" className="font-heading text-lg font-semibold">
              How many voices?
            </h2>
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
            <div className="rounded-xl border border-border bg-card p-3 text-sm">
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

        <div className="flex flex-wrap items-center gap-2 pt-2">
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
            <span className="text-xs text-muted-foreground">
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
      </form>
    </div>
  );
}
