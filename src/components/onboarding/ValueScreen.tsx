import Link from "next/link";
import {
  ArrowRightIcon,
  GitBranchIcon,
  PenLineIcon,
  RouteIcon,
  SparklesIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import { ClaimBanner } from "@/components/onboarding/ClaimBanner";
import { RoleAvatar } from "@/components/cast/RoleAvatar";
import { fixtureCast } from "@/lib/fixtures";

const DIRECT_MODES = [
  {
    icon: RouteIcon,
    title: "Pick a path",
    copy: "At decision points, 2 to 4 AI-written continuations appear inline. Picking one makes it canon.",
  },
  {
    icon: SlidersHorizontalIcon,
    title: "Steer",
    copy: "Drop an out-of-character note, “make her suspicious”, “skip to the duel”, and the cast adjusts.",
  },
  {
    icon: PenLineIcon,
    title: "Write in-character",
    copy: "Take any role's voice for a line. The AI cast reacts to what you wrote, not to a script.",
  },
] as const;

/** Value-first onboarding: concept, proof, CTA, no account wall. */
export function ValueScreen({ demo }: { demo: boolean }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-12 sm:px-6 sm:py-16">
      <ClaimBanner demo={demo} />

      <div className="max-w-3xl space-y-5">
        <p className="flex items-center gap-2 text-xs font-medium tracking-[0.3em] text-primary uppercase">
          <SparklesIcon className="size-4" aria-hidden />
          The director&apos;s chair
        </p>
        <h1 className="text-hero font-serif leading-[1.05] text-balance">
          Every character is AI.
          <br />
          You are the director.
        </h1>
        <p className="reading-measure text-base leading-relaxed text-muted-foreground sm:text-lg">
          Fabula casts a troupe of distinct characters, then hands you the room:
          choose the direction, steer from the wings, or step into any role, your own words included. Every choice can branch. Nothing is ever
          destroyed.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Link
            href="/new"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Start a scene
            <ArrowRightIcon className="size-4" aria-hidden />
          </Link>
          <Link
            href="/new/templates"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Browse templates
          </Link>
          <span className="text-xs text-muted-foreground">
            No account needed for the first scene.
          </span>
        </div>
      </div>

      <section aria-labelledby="preview-cast" className="mt-12 space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="preview-cast" className="font-heading text-sm font-semibold">
            A troupe like this walks in
          </h2>
          <span className="text-xs text-muted-foreground">
            names, hooks and voices, every card editable before play
          </span>
        </div>
        <ul className="grid gap-3 sm:grid-cols-3">
          {fixtureCast.map((role) => (
            <li
              key={role.id}
              className="flex items-start gap-3 rounded-xl border border-border bg-card p-3"
            >
              <RoleAvatar
                name={role.name}
                monogram={role.monogram}
                accentColor={role.accentColor}
                size="md"
              />
              <div className="min-w-0 space-y-1">
                <p className="font-heading text-sm font-semibold">{role.name}</p>
                <p className="text-[11px] tracking-wide text-primary uppercase">
                  {role.storyRole}
                </p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {role.hook}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="direction-modes" className="mt-12 space-y-3">
        <h2 id="direction-modes" className="font-heading text-sm font-semibold">
          Three ways to direct at any turn
        </h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {DIRECT_MODES.map((mode) => {
            const Icon = mode.icon;
            return (
              <li key={mode.title} className="space-y-2 rounded-xl border border-border bg-card p-4">
                <span className="flex size-8 items-center justify-center rounded-lg border border-border bg-muted text-primary">
                  <Icon className="size-4" aria-hidden />
                </span>
                <h3 className="font-heading text-sm font-semibold">{mode.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{mode.copy}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <section
        aria-labelledby="branch-law"
        className="mt-12 flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted text-primary">
          <GitBranchIcon className="size-5" aria-hidden />
        </span>
        <div className="space-y-1">
          <h2 id="branch-law" className="font-heading text-sm font-semibold">
            Branching is additive by law
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Picking a ghost path forks the story; editing a past beat preserves
            the original. Memory follows the active path only, so separate
            timelines never bleed into each other.
          </p>
        </div>
      </section>

      <footer className="mt-12 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
        <span>Self-hostable with Docker Compose · only AI provider keys are external</span>
        <span>Fabula · director&apos;s console</span>
      </footer>
    </div>
  );
}
