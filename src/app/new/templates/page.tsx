import type { Metadata } from "next";
import { TemplateGallery } from "@/components/onboarding/TemplateGallery";

export const metadata: Metadata = {
  title: "Templates · Fabula",
};

export default function TemplatesPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-6 sm:py-14">
      <p className="text-xs font-medium tracking-[0.2em] text-primary uppercase">
        Templates
      </p>
      <h1 className="mt-2 font-serif text-3xl leading-tight sm:text-4xl">
        Six rooms waiting for a cast.
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Each seed fills the premise, world, tone, style and a cast skeleton.
        You still review every card before the opening beat.
      </p>
      <div className="mt-8">
        <TemplateGallery />
      </div>
    </div>
  );
}
