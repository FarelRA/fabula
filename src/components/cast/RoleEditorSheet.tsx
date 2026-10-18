"use client";

import { useEffect, useId, useState } from "react";
import { Controller, useForm, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ROLE_ACCENTS } from "@/lib/cast/avatar";
import { ROLE_FIELD_LABELS, type RoleField } from "@/lib/cast/fields";
import {
  cardFromRoleValues,
  roleFormSchema,
  roleValuesFromCard,
  type RoleFormValues,
} from "@/lib/cast/roleForm";
import type { CastRole, RoleCardPatch } from "@/lib/cast/types";
import { cn } from "cn";

const STORY_ROLES = [
  ["protagonist", "Protagonist"],
  ["antagonist", "Antagonist"],
  ["foil", "Foil"],
  ["wildcard", "Wildcard"],
  ["support", "Support"],
] as const;

const TIERS = [
  ["spotlight", "Spotlight"],
  ["supporting", "Supporting"],
  ["background", "Background"],
] as const;

function TextField({
  label,
  error,
  registration,
  type = "text",
  placeholder,
  autoFocus,
}: {
  label: string;
  error?: string;
  registration: ReturnType<UseFormRegister<RoleFormValues>>;
  type?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        autoFocus={autoFocus}
        {...registration}
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function TextAreaField({
  label,
  error,
  registration,
  hint,
  rows = 3,
}: {
  label: string;
  error?: string;
  registration: ReturnType<UseFormRegister<RoleFormValues>>;
  hint?: string;
  rows?: number;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} rows={rows} aria-invalid={Boolean(error)} {...registration} />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

/**
 * The one role editor (PLAN §9.5): RHF + zod, shared by AI and human roles and
 * opened from any field's pencil (the initial field is emphasized).
 */
export function RoleEditorSheet({
  role,
  open,
  initialField,
  onOpenChange,
  onSave,
}: {
  role: CastRole | null;
  open: boolean;
  initialField?: RoleField;
  onOpenChange: (open: boolean) => void;
  onSave: (patch: RoleCardPatch) => Promise<void> | void;
}) {
  const [saving, setSaving] = useState(false);
  const form = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: role ? roleValuesFromCard(role.card) : undefined,
  });

  useEffect(() => {
    if (open && role) form.reset(roleValuesFromCard(role.card));
  }, [form, open, role]);

  if (!role) return null;

  const errors = form.formState.errors;

  const submit = form.handleSubmit(async (values) => {
    setSaving(true);
    try {
      const card = cardFromRoleValues(values, role.card);
      await onSave({
        identity: card.identity,
        hook: card.hook,
        psychology: card.psychology,
        voice: card.voice,
        drives: card.drives,
        boundariesLines: card.boundariesLines,
        meta: card.meta,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  });

  const sectionClass = (field: RoleField) =>
    cn(
      "space-y-3 rounded-xl border border-border/60 p-3",
      initialField === field && "border-primary/50 bg-primary/5",
    );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto pb-10 sm:max-w-xl"
        aria-describedby={undefined}
      >
        <SheetHeader>
          <SheetTitle>Edit {role.card.identity.name}</SheetTitle>
          <SheetDescription>
            Draft changes apply immediately; play revisions are versioned.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={submit} className="space-y-4 px-4 pb-8" noValidate>
          <section aria-label={ROLE_FIELD_LABELS.identity} className={sectionClass("identity")}>
            <h3 className="font-heading text-sm font-semibold">Identity</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="Name"
                error={errors.name?.message}
                registration={form.register("name")}
                autoFocus={initialField === "identity"}
              />
              <TextField
                label="Monogram"
                error={errors.monogram?.message}
                registration={form.register("monogram")}
              />
              <TextField
                label="Pronouns"
                error={errors.pronouns?.message}
                registration={form.register("pronouns")}
              />
              <TextField
                label="Age / era"
                error={errors.ageEra?.message}
                registration={form.register("ageEra")}
              />
              <TextField
                label="Occupation"
                error={errors.occupation?.message}
                registration={form.register("occupation")}
              />
              <div className="space-y-1.5">
                <Label>Accent</Label>
                <Controller
                  control={form.control}
                  name="accentColor"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger aria-label="Accent color">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_ACCENTS.map((accent) => (
                          <SelectItem key={accent} value={accent}>
                            {accent}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
          </section>

          <section aria-label={ROLE_FIELD_LABELS.hook} className={sectionClass("hook")}>
            <h3 className="font-heading text-sm font-semibold">Hook</h3>
            <TextAreaField
              label="One-line hook"
              error={errors.hook?.message}
              registration={form.register("hook")}
              rows={2}
            />
          </section>

          <section
            aria-label={ROLE_FIELD_LABELS.psychology}
            className={sectionClass("psychology")}
          >
            <h3 className="font-heading text-sm font-semibold">Personality</h3>
            <TextField
              label="Traits (comma separated)"
              error={errors.traits?.message}
              registration={form.register("traits")}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="Flaws"
                error={errors.flaws?.message}
                registration={form.register("flaws")}
              />
              <TextField
                label="Fears"
                error={errors.fears?.message}
                registration={form.register("fears")}
              />
              <TextField
                label="Desires"
                error={errors.desires?.message}
                registration={form.register("desires")}
              />
            </div>
            <TextAreaField
              label="Secret"
              error={errors.secret?.message}
              registration={form.register("secret")}
              rows={2}
            />
          </section>

          <section aria-label={ROLE_FIELD_LABELS.voice} className={sectionClass("voice")}>
            <h3 className="font-heading text-sm font-semibold">Voice</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="Register"
                error={errors.register?.message}
                registration={form.register("register")}
              />
              <TextField
                label="Rhythm"
                error={errors.rhythm?.message}
                registration={form.register("rhythm")}
              />
              <TextField
                label="Verbosity"
                error={errors.verbosity?.message}
                registration={form.register("verbosity")}
              />
              <TextField
                label="Vocabulary notes"
                error={errors.vocabularyNotes?.message}
                registration={form.register("vocabularyNotes")}
              />
            </div>
            <TextField
              label="Verbal tics (comma separated)"
              error={errors.verbalTics?.message}
              registration={form.register("verbalTics")}
            />
            <TextField
              label="Do not say (comma separated)"
              error={errors.doNotSay?.message}
              registration={form.register("doNotSay")}
            />
            <TextField
              label="Narration style"
              error={errors.narrationStyle?.message}
              registration={form.register("narrationStyle")}
            />
          </section>

          <section aria-label={ROLE_FIELD_LABELS.drives} className={sectionClass("drives")}>
            <h3 className="font-heading text-sm font-semibold">Goals & boundaries</h3>
            <TextAreaField
              label="Public goal"
              error={errors.publicGoal?.message}
              registration={form.register("publicGoal")}
              rows={2}
            />
            <TextAreaField
              label="Secret goal"
              error={errors.secretGoal?.message}
              registration={form.register("secretGoal")}
              rows={2}
            />
            <TextAreaField
              label="Stakes"
              error={errors.stakes?.message}
              registration={form.register("stakes")}
              rows={2}
            />
            <TextAreaField
              label="Lines this role won't cross (one per line)"
              error={errors.boundariesLines?.message}
              registration={form.register("boundariesLines")}
              rows={2}
            />
          </section>

          <section className="space-y-3 rounded-xl border border-border/60 p-3">
            <h3 className="font-heading text-sm font-semibold">Temperament</h3>
            {(
              [
                ["warmth", "Warmth"],
                ["impulse", "Impulse"],
                ["guile", "Guile"],
                ["optimism", "Optimism"],
              ] as const
            ).map(([name, label]) => (
              <Controller
                key={name}
                control={form.control}
                name={name}
                render={({ field }) => (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <Label>{label}</Label>
                      <span className="tabular-nums text-muted-foreground">
                        {field.value.toFixed(2)}
                      </span>
                    </div>
                    <Slider
                      aria-label={label}
                      min={0}
                      max={1}
                      step={0.05}
                      value={[field.value]}
                      onValueChange={(next) => field.onChange(next[0] ?? 0)}
                    />
                  </div>
                )}
              />
            ))}
          </section>

          <section aria-label={ROLE_FIELD_LABELS.meta} className={sectionClass("meta")}>
            <h3 className="font-heading text-sm font-semibold">Casting</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Story role</Label>
                <Controller
                  control={form.control}
                  name="storyRole"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger aria-label="Story role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STORY_ROLES.map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tier</Label>
                <Controller
                  control={form.control}
                  name="tier"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger aria-label="Tier">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIERS.map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Background roles speak only when addressed or directly affected.
            </p>
          </section>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <LoaderCircleIcon className="animate-spin" /> : null}
              Save role
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
