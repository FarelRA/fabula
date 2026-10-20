import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon, ShieldCheckIcon } from "lucide-react";
import { ThreeDoors } from "@/components/onboarding/ThreeDoors";

export const metadata: Metadata = {
  title: "Start a scene",
};

export default function NewScenePage() {
  return (
    <div className="stage-haze min-h-[calc(100dvh-3.5rem)]">
      <div className="studio-shell py-10 sm:py-14">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" aria-hidden />
          Back to the foyer
        </Link>

        <div className="mt-6 flex flex-col gap-5 border-b border-border/70 pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="cue text-primary">Rehearsal intake · Step 1 of 3</p>
            <h1 className="mt-3 font-serif text-4xl leading-[1.05] tracking-[-0.025em] text-balance sm:text-5xl">
              Choose how you want to walk in.
            </h1>
            <p className="mt-3 max-w-2xl font-serif text-base leading-relaxed text-muted-foreground sm:text-lg">
              Every door ends in the same place: an editable troupe, a drafted
              opening beat, and the play console. Nothing is generated until you
              ask for it.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-border/70 bg-card/40 px-3 py-2 text-xs text-muted-foreground">
            <ShieldCheckIcon className="size-4 text-primary" aria-hidden />
            No account required. Scenes stay in this browser until claimed.
          </div>
        </div>

        <div className="mt-8">
          <ThreeDoors />
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-border/60 pt-5 text-xs leading-relaxed text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            Not sure? Quick start is the fastest. Guided setup gives you tone and
            style. Templates begin from a genre skeleton you can rewrite card by
            card.
          </p>
          <Link href="/help" className="shrink-0 font-medium text-primary hover:underline">
            How directing works
          </Link>
        </div>
      </div>
    </div>
  );
}
