import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon, BookOpenIcon } from "lucide-react";
import { TemplateGallery } from "@/components/onboarding/TemplateGallery";

export const metadata: Metadata = {
  title: "Templates",
};

export default function TemplatesPage() {
  return (
    <div className="stage-haze min-h-[calc(100dvh-3.5rem)]">
      <div className="studio-shell py-10 sm:py-14">
        <Link
          href="/new"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" aria-hidden />
          Back to the three doors
        </Link>

        <header className="mt-6 max-w-3xl">
          <p className="cue flex items-center gap-2 text-primary">
            <BookOpenIcon className="size-3.5" aria-hidden />
            Door 03 · Repertoire
          </p>
          <h1 className="mt-3 font-serif text-4xl leading-[1.05] tracking-[-0.025em] text-balance sm:text-5xl">
            Six rooms waiting for a cast.
          </h1>
          <p className="mt-4 max-w-2xl font-serif text-base leading-relaxed text-muted-foreground sm:text-lg">
            A template sets the premise, world, tone, style and a cast skeleton.
            You still meet every role, edit every card, and write the opening
            yourself before the curtain rises.
          </p>
        </header>

        <div className="mt-8">
          <TemplateGallery />
        </div>
      </div>
    </div>
  );
}
