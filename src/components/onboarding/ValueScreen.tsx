import Link from "next/link";
import {
  ArrowRightIcon,
  BookOpenIcon,
  CheckIcon,
  GitBranchIcon,
  KeyRoundIcon,
  PenLineIcon,
  RouteIcon,
  ServerIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
} from "lucide-react";
import { RoleAvatar } from "@/components/cast/RoleAvatar";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { Wordmark } from "@/components/brand/Wordmark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { GENRE_PRESETS, toneSummary } from "@/lib/cast/presets";
import {
  fixtureBeats,
  fixtureCast,
  fixtureOptions,
  fixtureScene,
} from "@/lib/fixtures";

const PILLARS = [
  {
    icon: GitBranchIcon,
    cue: "Pillar 01",
    title: "Branching is a law, not a feature",
    copy: "Every fork is additive. Take a path, rewrite a line, or step back three acts: the original remains as a ghost path you can return to. Memory follows the active timeline, so separate stories stay sealed from one another.",
    aside: "Every branch preserved",
  },
  {
    icon: RouteIcon,
    cue: "Pillar 02",
    title: "Three ways to direct",
    copy: "Choose from AI-written continuations. Steer the cast from the wings. Or step onto the stage and write a line as any role. Each gesture has a different consequence, and the interface makes that difference legible.",
    aside: "Choose · Steer · Perform",
  },
  {
    icon: ServerIcon,
    cue: "Pillar 03",
    title: "Guest-first, self-hostable",
    copy: "Start without an account and keep your scenes in this browser until you claim them. Run the whole theatre on your own machine with Docker Compose, or bring your own AI provider keys. Only the model is external.",
    aside: "No account wall",
  },
];

const ROLE_VOICE: Record<string, string> = {
  role_linh:
    "“I’m not here for the money. I’m here for the name on the ledger.”",
  role_duc:
    "“Everyone in this city owes someone. You just haven’t met your creditor yet.”",
  role_widow:
    "“The man you’re looking for left three days ago. So did the rain.”",
};

const DIRECT_MODES = [
  {
    icon: RouteIcon,
    title: "Choose",
    copy: "Pick a possible future at a decision point; the chosen continuation becomes canon.",
  },
  {
    icon: SlidersHorizontalIcon,
    title: "Steer",
    copy: "Whisper a direction from the wings. The cast adjusts without breaking the scene.",
  },
  {
    icon: PenLineIcon,
    title: "Perform",
    copy: "Take any role's voice for a line. The troupe reacts to what you wrote.",
  },
];

/** Value-first onboarding: concept, proof, CTA, no account wall. */
export function ValueScreen({ demo }: { demo: boolean }) {
  const [opening, reply] = fixtureBeats;
  const featuredPresets = GENRE_PRESETS.slice(0, 3);

  return (
    <div className="stage-haze overflow-hidden">
      <section className="studio-shell relative pt-12 pb-16 sm:pt-16 lg:pt-20 lg:pb-24">
        <div className="grid items-center gap-12 lg:grid-cols-[0.92fr_1.08fr] xl:gap-16">
          <div className="max-w-2xl">
            <p className="cue mb-5 flex items-center gap-2 text-primary">
              <span className="size-1.5 rounded-full bg-primary shadow-[0_0_10px_var(--primary)]" aria-hidden />
              An AI cast. A human director.
            </p>
            <h1 className="text-hero font-serif leading-[0.98] tracking-[-0.035em] text-balance">
              Every character is AI.
              <span className="mt-2 block italic text-primary">You are the director.</span>
            </h1>
            <p className="mt-6 max-w-xl font-serif text-lg leading-relaxed text-muted-foreground sm:text-xl">
              Direct living theatrical fiction. Pick a path, steer from the wings,
              or step into any role. Every choice can branch, and nothing is ever
              destroyed.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href="/new">
                  Start a scene
                  <ArrowRightIcon aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/new/templates">
                  <BookOpenIcon aria-hidden />
                  Browse templates
                </Link>
              </Button>
            </div>
            <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CheckIcon className="size-3.5 text-primary" aria-hidden />
                No account for the first scene
              </span>
              <span className="inline-flex items-center gap-1.5">
                <GitBranchIcon className="size-3.5 text-primary" aria-hidden />
                Every fork preserved
              </span>
              <span className="inline-flex items-center gap-1.5">
                <KeyRoundIcon className="size-3.5 text-primary" aria-hidden />
                Your keys, your stage
              </span>
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              {demo
                ? "This demo casts and rehearses locally in your browser. Nothing leaves this device."
                : "Guest scenes live in this browser until you claim them."}
            </p>
          </div>

          <ConsolePreview opening={opening?.text ?? ""} reply={reply?.text ?? ""} />
        </div>
      </section>

      <section className="border-y border-border/70 bg-card/30">
        <div className="studio-shell grid gap-6 py-12 md:grid-cols-3 md:gap-0 md:py-14">
          {PILLARS.map((pillar, index) => {
            const Icon = pillar.icon;
            return (
              <article
                key={pillar.title}
                className={
                  index === 0
                    ? "md:pr-8"
                    : index === 1
                      ? "md:border-x md:border-border/70 md:px-8"
                      : "md:pl-8"
                }
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-sm border border-primary/25 bg-primary/10 text-primary">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <p className="cue text-primary">{pillar.cue}</p>
                </div>
                <h2 className="mt-4 font-serif text-xl leading-snug text-foreground">
                  {pillar.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {pillar.copy}
                </p>
                <p className="mt-4 inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.12em] text-muted-foreground/80 uppercase">
                  <span className="size-1 rounded-full bg-primary" aria-hidden />
                  {pillar.aside}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="studio-shell py-16 sm:py-20">
        <SectionHeading
          cue="The company"
          title="Meet a troupe before the curtain rises."
          description="Every card is editable: identity, hook, psychology, voice and relationships. The cast arrives as people, not as a list of prompts."
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/new/wizard">
                Build a cast
                <ArrowRightIcon aria-hidden />
              </Link>
            </Button>
          }
        />
        <ul className="mt-8 grid gap-4 md:grid-cols-3">
          {fixtureCast.map((role, index) => (
            <li key={role.id}>
              <Surface
                tone={index === 0 ? "glow" : "raised"}
                padding="none"
                className="group h-full overflow-hidden"
              >
                <div className="flex items-start gap-3 border-b border-border/70 p-4">
                  <RoleAvatar
                    name={role.name}
                    monogram={role.monogram}
                    accentColor={role.accentColor}
                    size="md"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="cue text-[0.6rem] text-muted-foreground">
                      {role.storyRole} · {role.tier}
                    </p>
                    <h3 className="mt-1 truncate font-serif text-xl leading-tight">
                      {role.name}
                    </h3>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {role.hook}
                    </p>
                  </div>
                </div>
                <div className="space-y-3 p-4">
                  <p className="font-serif text-[15px] leading-relaxed text-foreground/85 italic">
                    {ROLE_VOICE[role.id] ??
                      "“Every door in this city opens for someone. Tonight it opens for the person holding the ledger.”"}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline">Editable card</Badge>
                    <Badge variant="outline">Voice sample</Badge>
                    <Badge variant="outline">Secrets</Badge>
                  </div>
                </div>
              </Surface>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-y border-border/70 bg-card/30">
        <div className="studio-shell py-16 sm:py-20">
          <SectionHeading
            cue="The directing desk"
            title="One story, three gestures."
            description="The play console keeps the story in the centre and the controls at the edge of the light. Nothing interrupts the reading until you reach for it."
          />
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {DIRECT_MODES.map((mode, index) => {
              const Icon = mode.icon;
              return (
                <Surface key={mode.title} tone="raised" className="flex gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-sm border border-border bg-muted/60 font-mono text-xs text-primary">
                    0{index + 1}
                  </span>
                  <div>
                    <h3 className="flex items-center gap-2 font-serif text-xl">
                      <Icon className="size-4 text-primary" aria-hidden />
                      {mode.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {mode.copy}
                    </p>
                  </div>
                </Surface>
              );
            })}
          </div>
        </div>
      </section>

      <section className="studio-shell py-16 sm:py-20">
        <SectionHeading
          cue="The repertoire"
          title="Six rooms waiting for a cast."
          description="Noir, court intrigue, a ship at the edge of charted space, a conservatory, a crossroads tavern, a duel of letters. Start from a world and rewrite every card."
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/new/templates">
                All six worlds
                <ArrowRightIcon aria-hidden />
              </Link>
            </Button>
          }
        />
        <ul className="mt-8 grid gap-4 md:grid-cols-3">
          {featuredPresets.map((preset, index) => (
            <li key={preset.id}>
              <Surface tone="raised" padding="none" className="group h-full overflow-hidden">
                <div className="relative flex h-40 items-end overflow-hidden border-b border-border/70 bg-[radial-gradient(circle_at_28%_18%,color-mix(in_oklab,var(--primary)_28%,transparent),transparent_58%),linear-gradient(145deg,var(--card),var(--background))] p-4">
                  <div className="absolute inset-0 opacity-25 staff-lines" aria-hidden />
                  <div className="relative">
                    <p className="cue text-[0.6rem] text-primary">
                      Volume {String(index + 1).padStart(2, "0")}
                    </p>
                    <h3 className="mt-1 font-serif text-2xl leading-tight text-foreground">
                      {preset.name}
                    </h3>
                  </div>
                </div>
                <div className="space-y-3 p-4">
                  <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                    {preset.premise}
                  </p>
                  <p className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground/80 uppercase">
                    {toneSummary(preset.tone)} · {preset.castSize} roles
                  </p>
                  <Link
                    href={`/new/wizard?template=${preset.id}&step=cast`}
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    Enter this world
                    <ArrowRightIcon className="size-3.5" aria-hidden />
                  </Link>
                </div>
              </Surface>
            </li>
          ))}
        </ul>
      </section>

      <section className="studio-shell pb-16 sm:pb-20">
        <Surface
          tone="glow"
          padding="lg"
          className="grid items-center gap-6 overflow-hidden lg:grid-cols-[1fr_auto]"
        >
          <div className="flex items-start gap-4">
            <span className="hidden size-11 shrink-0 items-center justify-center rounded-sm border border-primary/30 bg-primary/10 text-primary sm:flex">
              <ServerIcon className="size-5" aria-hidden />
            </span>
            <div>
              <p className="cue text-primary">Self-hosted by design</p>
              <h2 className="mt-2 font-serif text-2xl leading-tight">
                The stage belongs to you.
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Fabula runs as a Next.js app with a Convex backend, packaged for
                Docker Compose. Your scenes, prompts and branches stay in your
                deployment. Bring an OpenAI, Anthropic or compatible provider key
                and the cast walks in.
              </p>
            </div>
          </div>
          <div className="rounded-md border border-border/80 bg-background/70 px-4 py-3 font-mono text-xs leading-relaxed text-muted-foreground">
            <p className="text-primary">$ docker compose up -d</p>
            <p>fabula-app · fabula-api · your keys</p>
          </div>
        </Surface>
      </section>

      <section className="border-t border-border/70">
        <div className="studio-shell flex flex-col items-center gap-5 py-16 text-center sm:py-20">
          <span className="flex size-11 items-center justify-center rounded-sm border border-primary/30 bg-primary/10 text-primary">
            <SparklesIcon className="size-5" aria-hidden />
          </span>
          <h2 className="max-w-2xl font-serif text-3xl leading-tight text-balance sm:text-4xl">
            The stage is dark. Call the first cue.
          </h2>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            One line is enough. The troupe arrives, the opening beat lands, and
            the next move is yours.
          </p>
          <Button asChild size="lg">
            <Link href="/new">
              Enter the rehearsal room
              <ArrowRightIcon aria-hidden />
            </Link>
          </Button>
          <p className="text-xs text-muted-foreground">
            No email. No account. No paywall before the first scene.
          </p>
        </div>
      </section>

      <footer className="border-t border-border/70 bg-card/30">
        <div className="studio-shell flex flex-col gap-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <Wordmark />
            <span className="hidden sm:inline">The rehearsal room for an AI cast.</span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/help" className="hover:text-foreground">
              How to direct
            </Link>
            <Link href="/new/templates" className="hover:text-foreground">
              Templates
            </Link>
            <span>Nothing is destroyed.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ConsolePreview({ opening, reply }: { opening: string; reply: string }) {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-6 -z-10 rounded-[2rem] bg-[radial-gradient(circle_at_60%_20%,color-mix(in_oklab,var(--primary)_14%,transparent),transparent_68%)] blur-2xl"
      />
      <Surface
        tone="raised"
        padding="none"
        className="overflow-hidden shadow-[0_40px_120px_-50px_rgb(0_0_0_0.9)]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-background/35 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-destructive/70" aria-hidden />
            <span className="size-2 rounded-full bg-primary/80" aria-hidden />
            <span className="size-2 rounded-full bg-role-teal/80" aria-hidden />
            <p className="ml-2 font-mono text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
              Rehearsal · {fixtureScene.title}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-primary">
            <span className="size-1.5 animate-pulse rounded-full bg-primary motion-reduce:animate-none" aria-hidden />
            Live
          </span>
        </div>

        <div className="grid min-h-[24rem] sm:grid-cols-[0.7fr_1.45fr]">
          <div className="hidden border-r border-border/70 bg-background/20 p-3 sm:block">
            <p className="cue mb-3 text-[0.6rem] text-muted-foreground">On stage</p>
            <ul className="space-y-2">
              {fixtureCast.map((role, index) => (
                <li
                  key={role.id}
                  className={
                    index === 1
                      ? "rounded-sm border border-primary/25 bg-primary/8 p-2"
                      : "rounded-sm border border-transparent p-2"
                  }
                >
                  <div className="flex items-center gap-2">
                    <RoleAvatar
                      name={role.name}
                      monogram={role.monogram}
                      accentColor={role.accentColor}
                      className="size-7 text-[10px]"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-foreground">
                        {role.name}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {role.storyRole}
                      </p>
                    </div>
                    {index === 1 ? (
                      <span className="ml-auto size-1.5 rounded-full bg-primary" aria-hidden />
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-5 border-t border-border/60 pt-3">
              <p className="cue text-[0.6rem] text-muted-foreground">Floor</p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                Mr. Đức has the floor. 2 paths open.
              </p>
            </div>
          </div>

          <div className="flex min-w-0 flex-col">
            <div className="flex-1 space-y-4 p-4 sm:p-5">
              <div className="space-y-1.5">
                <p className="cue text-[0.6rem] text-muted-foreground">Opening beat</p>
                <p className="font-serif text-[15px] leading-relaxed text-foreground/90 italic">
                  {opening}
                </p>
              </div>
              <div className="border-l-2 border-role-teal/70 pl-3">
                <p className="cue text-[0.6rem] text-foreground/75">Mr. Đức</p>
                <p className="mt-1 font-serif text-[15px] leading-relaxed text-foreground/90">
                  {reply}
                </p>
              </div>
              <div className="space-y-2 border-t border-border/60 pt-3">
                <div className="flex items-center justify-between">
                  <p className="cue text-[0.6rem] text-primary">Choose the next beat</p>
                  <span className="font-mono text-[9px] text-muted-foreground">
                    Alt + 1–3
                  </span>
                </div>
                <div className="grid gap-1.5">
                  {fixtureOptions.slice(0, 2).map((option, index) => (
                    <div
                      key={option.id}
                      className={
                        index === 0
                          ? "rounded-sm border border-primary/35 bg-primary/8 px-2.5 py-2"
                          : "rounded-sm border border-border/70 bg-background/30 px-2.5 py-2"
                      }
                    >
                      <p className="text-[11px] font-medium text-foreground">
                        {option.label}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">
                        {option.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="border-t border-border/70 bg-background/30 px-4 py-2.5">
              <p className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <PenLineIcon className="size-3 text-primary" aria-hidden />
                Steer from the wings, or step into a role.
              </p>
            </div>
          </div>
        </div>
      </Surface>
    </div>
  );
}
