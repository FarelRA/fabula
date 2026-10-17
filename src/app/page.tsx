/**
 * Value-first onboarding (PLAN §9.2; full flows arrive in Phase 4).
 * No account wall — the CTA path opens scene creation directly once the
 * three doors ship.
 */

const IDENTITY_CHIPS = [
  { name: "amber", className: "bg-role-amber text-role-amber-foreground" },
  { name: "teal", className: "bg-role-teal text-role-teal-foreground" },
  { name: "violet", className: "bg-role-violet text-role-violet-foreground" },
  { name: "rose", className: "bg-role-rose text-role-rose-foreground" },
  { name: "sky", className: "bg-role-sky text-role-sky-foreground" },
  { name: "lime", className: "bg-role-lime text-role-lime-foreground" },
  { name: "orange", className: "bg-role-orange text-role-orange-foreground" },
  { name: "indigo", className: "bg-role-indigo text-role-indigo-foreground" },
];

export default function Home() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col justify-center gap-8 px-6 py-20 sm:py-28">
      <p className="text-sm font-medium tracking-[0.35em] text-primary uppercase">Fabula</p>
      <h1 className="text-hero max-w-3xl text-balance font-serif leading-tight">
        Every character is AI. You are the director.
      </h1>
      <p className="reading-measure text-lg leading-relaxed text-muted-foreground">
        Create a scene, cast an ensemble of distinct AI roles, and steer the story:
        pick from AI-written paths, drop out-of-character notes, or write a line
        yourself. Nothing is destroyed — every choice can branch, and every branch
        can be explored.
      </p>
      <div className="flex flex-wrap gap-3">
        <span className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
          Scene creation is next on the roadmap
        </span>
        <span className="rounded-full border border-border px-5 py-2.5 text-sm text-muted-foreground">
          Self-hostable · Docker Compose
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-2 text-xs text-muted-foreground">
        <span className="mr-1">Identity palette:</span>
        {IDENTITY_CHIPS.map((chip) => (
          <span
            key={chip.name}
            className={`rounded-full px-2 py-0.5 font-medium ${chip.className}`}
          >
            {chip.name}
          </span>
        ))}
      </div>
      <footer className="pt-10 text-sm text-muted-foreground/80">
        Foundation, domain core and the generation engine are live: branch laws,
        path-scoped memory, streaming turns, casting. The director&apos;s chair is
        being built.
      </footer>
    </div>
  );
}
