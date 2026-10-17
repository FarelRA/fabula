/**
 * Value-first onboarding (PLAN §2.1, full flow lands in Phase 3/4).
 * No account wall: the CTA path opens scene creation directly once the wizard
 * ships.
 */
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-8 px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-[0.35em] text-accent">
        Fabula
      </p>
      <h1 className="font-serif text-4xl leading-tight text-balance sm:text-6xl">
        Every character is AI. You are the director.
      </h1>
      <p className="max-w-xl text-lg leading-relaxed text-parchment/70">
        Create a scene, cast an ensemble of distinct AI roles, and steer the story:
        pick from AI-written paths, drop out-of-character notes, or write a line
        yourself. Nothing is destroyed — every choice can branch, and every branch
        can be explored.
      </p>
      <div className="flex flex-wrap gap-3">
        <span className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-stage-950">
          Scene creation is next on the roadmap
        </span>
        <span className="rounded-full border border-stage-700 px-5 py-2.5 text-sm text-parchment/70">
          Self-hostable · Docker Compose
        </span>
      </div>
      <footer className="pt-8 text-sm text-parchment/40">
        Foundation and domain core are live: branch laws, path-scoped memory,
        undo, sharing, usage. The director&apos;s chair is being built.
      </footer>
    </main>
  );
}
