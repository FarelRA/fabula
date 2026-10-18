import type { Metadata } from "next";
import { ThreeDoors } from "@/components/onboarding/ThreeDoors";

export const metadata: Metadata = {
  title: "Start a scene · Fabula",
};

export default function NewScenePage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-6 sm:py-14">
      <p className="text-xs font-medium tracking-[0.2em] text-primary uppercase">
        New scene
      </p>
      <h1 className="mt-2 font-serif text-3xl leading-tight sm:text-4xl">
        Choose how you want to walk in.
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        All three doors end in the same place: an editable cast, a drafted
        opening beat, and the play table. Nothing is generated until you ask.
      </p>
      <div className="mt-8">
        <ThreeDoors />
      </div>
      <p className="mt-6 max-w-2xl text-xs leading-relaxed text-muted-foreground">
        Not sure? Quick start is fastest. Guided setup gives you the tone dials
        and presentation style; templates begin from a genre skeleton you can
        rewrite card by card.
      </p>
    </div>
  );
}
