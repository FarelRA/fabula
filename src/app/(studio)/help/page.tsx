import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRightIcon,
  BookOpenIcon,
  GitBranchIcon,
  KeyboardIcon,
  PenLineIcon,
  RouteIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";

export const metadata: Metadata = {
  title: "How to direct",
};

const MODES = [
  {
    icon: RouteIcon,
    title: "Choose a path",
    cue: "Commit a future",
    copy: "When a decision point opens, two to four possible continuations appear under the beat. Picking one makes it canon on the active branch. Unpicked continuations become ghost paths under that beat; they are never discarded.",
    note: "Shortcut: Alt/Option + 1–4 picks a path without leaving the keyboard.",
  },
  {
    icon: SlidersHorizontalIcon,
    title: "Steer from the wings",
    cue: "Adjust the weather",
    copy: "A steer is an out-of-character note for the cast: raise the stakes, let her hesitate, cut to the morning. Notes apply to upcoming beats and stay visible until you resolve them. You can also steer and regenerate the last beat to fork a fresh take.",
    note: "The cast sees the note; the characters do not hear it as dialogue.",
  },
  {
    icon: PenLineIcon,
    title: "Perform a line",
    cue: "Step into the light",
    copy: "Write as any active role. Your line becomes canon and the AI cast reacts to it. This is the most direct way to change the temperature of a scene without asking the model to do it for you.",
    note: "Wait for the current beat to finish, or abort it first.",
  },
];

export default function HelpPage() {
  return (
    <div className="stage-haze min-h-[calc(100dvh-3.5rem)]">
      <div className="studio-shell py-10 sm:py-14">
        <header className="max-w-3xl">
          <p className="cue flex items-center gap-2 text-primary">
            <BookOpenIcon className="size-3.5" aria-hidden />
            The director&apos;s handbook
          </p>
          <h1 className="mt-3 font-serif text-4xl leading-[1.05] tracking-[-0.025em] text-balance sm:text-5xl">
            You are not chatting with an assistant.
            <span className="block italic text-primary">You are directing a company.</span>
          </h1>
          <p className="mt-4 max-w-2xl font-serif text-base leading-relaxed text-muted-foreground sm:text-lg">
            Fabula is a rehearsal room, not a prompt box. The cast plays every
            character; you choose what becomes canon, what is only a possibility,
            and when the story has found its ending.
          </p>
        </header>

        <section aria-labelledby="modes-heading" className="mt-10">
          <div className="flex items-end justify-between gap-3 border-b border-border/70 pb-3">
            <div>
              <p className="cue text-primary">The three gestures</p>
              <h2 id="modes-heading" className="mt-1 font-serif text-2xl">
                Choose, steer, or perform.
              </h2>
            </div>
            <span className="hidden font-mono text-[10px] text-muted-foreground sm:inline">
              Always available in the console
            </span>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {MODES.map((mode, index) => {
              const Icon = mode.icon;
              return (
                <Surface key={mode.title} tone="raised" className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="flex size-9 items-center justify-center rounded-sm border border-primary/25 bg-primary/10 text-primary">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      0{index + 1}
                    </span>
                  </div>
                  <div>
                    <p className="cue text-[0.6rem] text-primary">{mode.cue}</p>
                    <h3 className="mt-1 font-serif text-xl leading-tight">{mode.title}</h3>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">{mode.copy}</p>
                  <p className="mt-auto border-t border-border/60 pt-3 text-[11px] leading-relaxed text-muted-foreground">
                    {mode.note}
                  </p>
                </Surface>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="laws-heading" className="mt-10 grid gap-4 lg:grid-cols-2">
          <Surface tone="recessed" className="space-y-3">
            <div className="flex items-center gap-2 text-primary">
              <GitBranchIcon className="size-4" aria-hidden />
              <p className="cue">Branching by law</p>
            </div>
            <h2 id="laws-heading" className="font-serif text-2xl leading-tight">
              Nothing is destroyed.
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Editing a past beat, regenerating a take, or choosing a ghost path
              forks the story. The original branch remains readable in the archive.
              Memory follows the active path, with pinned facts as the only
              deliberate bridge across timelines.
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Undo is always the last action, not a hidden setting. If something
              surprises you, undo it and try a different gesture.
            </p>
          </Surface>

          <Surface tone="recessed" className="space-y-3">
            <div className="flex items-center gap-2 text-primary">
              <SparklesIcon className="size-4" aria-hidden />
              <p className="cue">The floor</p>
            </div>
            <h2 className="font-serif text-2xl leading-tight">
              The cast keeps moving; you set the tempo.
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              The floor decides who speaks next. Auto-burst lets the cast take a
              few beats without asking, then stops at a decision point. Pause
              freezes the burst; offer paths asks for new possibilities; mention a
              role to hand them the floor.
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              A scene never wraps itself. When the story feels resolved, the
              console suggests an ending. You decide whether to close the
              production or keep playing.
            </p>
          </Surface>
        </section>

        <section className="mt-10 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <Surface tone="flat" className="space-y-3">
            <div className="flex items-center gap-2 text-primary">
              <ShieldCheckIcon className="size-4" aria-hidden />
              <p className="cue">Guests and accounts</p>
            </div>
            <h2 className="font-serif text-2xl leading-tight">Start first. Claim later.</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              A guest session can cast, play and branch without an account. Scenes
              live in this browser until you claim them. Claiming keeps the same
              stories and moves them into your account; it never gates the first
              scene or the fun of experimentation.
            </p>
            <Link
              href="/library"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              Open your scene library
              <ArrowRightIcon className="size-3.5" aria-hidden />
            </Link>
          </Surface>

          <Surface tone="flat" className="space-y-3">
            <div className="flex items-center gap-2 text-primary">
              <KeyboardIcon className="size-4" aria-hidden />
              <p className="cue">Keyboard and command</p>
            </div>
            <h2 className="font-serif text-2xl leading-tight">
              A director&apos;s hands stay on the desk.
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              The command palette is <kbd className="rounded-sm border border-border bg-muted px-1 font-sans text-[11px]">Ctrl</kbd>{" "}
              <kbd className="rounded-sm border border-border bg-muted px-1 font-sans text-[11px]">K</kbd>{" "}
              on every surface. Path picks are Alt/Option + a number, undo is
              Ctrl/⌘ Z, and the inspector and map have their own bindings. Press{" "}
              <kbd className="rounded-sm border border-border bg-muted px-1 font-sans text-[11px]">?</kbd>{" "}
              to see the whole map.
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Everything is reachable without a mouse, including the cast editor,
              path choices, sharing and the archive.
            </p>
          </Surface>
        </section>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-border/70 pt-6 sm:flex-row sm:items-center">
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            Ready to try the gestures with a real cast? The first scene needs only
            a premise.
          </p>
          <Button asChild size="lg">
            <Link href="/new">
              Start a scene
              <ArrowRightIcon aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
