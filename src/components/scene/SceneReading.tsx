import Link from "next/link";
import { ArrowLeftIcon, SparklesIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RoleAvatar } from "@/components/cast/RoleAvatar";
import { tierLabel } from "@/lib/cast/labels";
import type { CastScene } from "@/lib/cast/types";

/**
 * Play handoff (PLAN Phase 4.6 → Phase 5): renders the scene's path beats with
 * the reading measure and cast strip. The full director console (composer,
 * options, floor, inspector) lands in Phase 5; this surface only ever shows
 * real, committed beats.
 */
export function SceneReading({ scene }: { scene: CastScene }) {
  const speakerById = new Map(
    scene.roles.map((role) => [role.id, role.card.identity.name]),
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-6 sm:py-12">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3.5" aria-hidden />
        Leave the table
      </Link>

      <header className="mt-4 space-y-3">
        <p className="flex items-center gap-1.5 text-xs font-medium tracking-[0.2em] text-primary uppercase">
          <SparklesIcon className="size-3.5" aria-hidden />
          Scene
        </p>
        <div className="flex flex-wrap items-baseline gap-2">
          <h1 className="font-serif text-3xl leading-tight sm:text-4xl">{scene.title}</h1>
          <Badge variant="outline">{scene.status}</Badge>
        </div>
        <p className="reading-measure text-sm leading-relaxed text-muted-foreground">
          {scene.premise}
        </p>
        <ul className="flex flex-wrap gap-2 pt-1" aria-label="Cast">
          {scene.roles
            .filter((role) => role.status === "active")
            .map((role) => (
              <li
                key={role.id}
                className="flex items-center gap-2 rounded-full border border-border bg-card py-0.5 pr-2.5 pl-0.5"
              >
                <RoleAvatar
                  name={role.card.identity.name}
                  monogram={role.card.identity.monogram}
                  accentColor={role.card.identity.accentColor}
                  size="sm"
                  className="size-7 text-[11px]"
                />
                <span className="text-xs font-medium">{role.card.identity.name}</span>
                <span className="text-[10px] tracking-wide text-muted-foreground uppercase">
                  {tierLabel(role.card.meta.tier)}
                </span>
              </li>
            ))}
        </ul>
      </header>

      <section aria-labelledby="beats-heading" className="mt-10">
        <h2 id="beats-heading" className="sr-only">
          Scene beats
        </h2>
        {scene.beats.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            The stage is set, but the first beat has not been written.
          </p>
        ) : (
          <ol className="space-y-7">
            {scene.beats.map((beat) => (
              <li key={beat.id} className="reading-measure space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {beat.speakerRoleId
                      ? speakerById.get(beat.speakerRoleId) ?? "Narrator"
                      : "Narrator"}
                  </span>
                  <Badge variant="secondary" className="font-normal">
                    {beat.origin === "opening" ? "Opening" : `Beat ${beat.seq}`}
                  </Badge>
                </div>
                <p className="whitespace-pre-wrap font-serif text-lg leading-relaxed">
                  {beat.text}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <footer className="mt-12 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
        <span>
          {scene.beats.length} {scene.beats.length === 1 ? "beat" : "beats"} on the
          active path
        </span>
        <span>No branch has been destroyed.</span>
      </footer>
    </div>
  );
}
