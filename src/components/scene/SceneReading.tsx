import Link from "next/link";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  GitBranchIcon,
  PenLineIcon,
  RouteIcon,
  SparklesIcon,
  UsersIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { RoleAvatar } from "@/components/cast/RoleAvatar";
import { tierLabel } from "@/lib/cast/labels";
import { roleAccent } from "@/lib/cast/avatar";
import type { CastScene } from "@/lib/cast/types";

/**
 * Reading handoff for deterministic fixture scenes. The live deployment uses
 * the full director console; this surface shows the committed path in the same
 * editorial voice, with no pretend controls.
 */
export function SceneReading({ scene }: { scene: CastScene }) {
  const activeRoles = scene.roles.filter((role) => role.status === "active");
  const speakerById = new Map(
    scene.roles.map((role) => [role.id, role.card.identity.name]),
  );
  const speakerRoleById = new Map(scene.roles.map((role) => [role.id, role]));

  return (
    <div className="stage-haze min-h-dvh">
      <div className="studio-shell py-8 sm:py-10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftIcon className="size-3.5" aria-hidden />
            Leave the table
          </Link>
          <Badge variant="outline" className="font-normal">
            Demo reading · live console in a full build
          </Badge>
        </div>

        <header className="mt-5 grid gap-7 border-b border-border/70 pb-7 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
          <div className="min-w-0 max-w-3xl">
            <p className="cue flex items-center gap-2 text-primary">
              <SparklesIcon className="size-3.5" aria-hidden />
              A scene in progress
            </p>
            <div className="mt-2 flex flex-wrap items-baseline gap-2.5">
              <h1 className="font-serif text-4xl leading-[1.04] tracking-[-0.025em] text-balance sm:text-5xl">
                {scene.title}
              </h1>
              <Badge variant={scene.status === "playing" ? "default" : "outline"} className="font-normal capitalize">
                {scene.status}
              </Badge>
            </div>
            <p className="mt-3 max-w-2xl font-serif text-base leading-relaxed text-muted-foreground sm:text-lg">
              {scene.premise}
            </p>
          </div>

          <aside aria-label="Cast" className="space-y-2">
            <p className="cue flex items-center gap-1.5 text-muted-foreground">
              <UsersIcon className="size-3.5 text-primary" aria-hidden />
              On stage
            </p>
            <ul className="grid gap-1.5">
              {activeRoles.map((role) => {
                const accent = roleAccent(role.card.identity.accentColor);
                return (
                  <li
                    key={role.id}
                    style={{ borderLeftColor: `var(--role-${accent})` }}
                    className="flex items-center gap-2.5 rounded-md border border-l-2 border-border/70 bg-card/30 px-2.5 py-2"
                  >
                    <RoleAvatar
                      name={role.card.identity.name}
                      monogram={role.card.identity.monogram}
                      accentColor={role.card.identity.accentColor}
                      size="sm"
                      className="size-8 text-[10px]"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-serif text-[15px] leading-tight">
                        {role.card.identity.name}
                      </p>
                      <p className="truncate font-mono text-[9px] text-muted-foreground">
                        {role.card.meta.storyRole} · {tierLabel(role.card.meta.tier)}
                      </p>
                    </div>
                    {role.kind === "human" ? (
                      <span className="font-mono text-[8px] tracking-[0.08em] text-primary uppercase">
                        you
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </aside>
        </header>

        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <section aria-labelledby="beats-heading">
            <div className="flex items-end justify-between gap-3 border-b border-border/60 pb-3">
              <div>
                <p className="cue text-primary">The manuscript</p>
                <h2 id="beats-heading" className="mt-1 font-serif text-2xl leading-tight">
                  Opening beats
                </h2>
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">
                {scene.beats.length} beat{scene.beats.length === 1 ? "" : "s"} on the
                active path
              </span>
            </div>

            {scene.beats.length === 0 ? (
              <p className="mt-5 rounded-md border border-dashed border-border/70 bg-card/20 px-4 py-10 text-center font-serif text-lg text-muted-foreground">
                The stage is set, but the first beat has not been written.
              </p>
            ) : (
              <ol className="mt-5 space-y-5">
                {scene.beats.map((beat) => {
                  const role = beat.speakerRoleId
                    ? speakerRoleById.get(beat.speakerRoleId)
                    : undefined;
                  const accent = role
                    ? `var(--role-${roleAccent(role.card.identity.accentColor)})`
                    : "var(--border)";
                  return (
                    <li key={beat.id}>
                      <article
                        style={{ borderLeftColor: accent }}
                        className="border-l-2 py-1 pl-4 sm:pl-5"
                      >
                        <header className="flex items-center gap-2">
                          {role ? (
                            <RoleAvatar
                              name={role.card.identity.name}
                              monogram={role.card.identity.monogram}
                              accentColor={role.card.identity.accentColor}
                              size="sm"
                              className="size-7 text-[10px]"
                            />
                          ) : null}
                          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="font-sans text-[11px] font-bold tracking-[0.14em] text-foreground uppercase">
                              {beat.speakerRoleId
                                ? speakerById.get(beat.speakerRoleId) ?? "Narrator"
                                : "Narrator"}
                            </span>
                            <span className="font-mono text-[9px] text-muted-foreground uppercase">
                              {beat.origin === "opening" ? "Opening" : `Beat ${beat.seq}`}
                            </span>
                          </p>
                        </header>
                        <p className="mt-2 font-serif text-[1.12rem] leading-[1.8] whitespace-pre-wrap text-foreground/85 sm:text-[1.18rem]">
                          {beat.text}
                        </p>
                      </article>
                    </li>
                  );
                })}
              </ol>
            )}

            <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-4 text-[11px] text-muted-foreground">
              <span>Nothing on this path has been destroyed.</span>
              <span className="font-mono text-[10px]">
                {scene.status} · {scene.roles.length} roles
              </span>
            </footer>
          </section>

          <aside className="space-y-4 lg:sticky lg:top-8">
            <Surface tone="glow" padding="md">
              <p className="cue text-primary">The director&apos;s console</p>
              <h2 className="mt-2 font-serif text-xl leading-tight">
                This is the reading view.
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                A live scene adds path choices, steering notes, in-character
                writing, the branch map and the memory inspector. The demo keeps
                the committed path in the same voice.
              </p>
              <Button asChild size="sm" className="mt-3 w-full">
                <Link href="/new">
                  Start a live scene
                  <ArrowRightIcon aria-hidden />
                </Link>
              </Button>
            </Surface>

            <Surface tone="flat" padding="md">
              <p className="cue text-muted-foreground">The room in three moves</p>
              <ol className="mt-3 space-y-3">
                {[
                  {
                    icon: RouteIcon,
                    title: "Choose a path",
                    copy: "At a decision point, pick the future that becomes canon.",
                  },
                  {
                    icon: PenLineIcon,
                    title: "Steer or perform",
                    copy: "Whisper direction from the wings, or write a line as any role.",
                  },
                  {
                    icon: GitBranchIcon,
                    title: "Fork without fear",
                    copy: "Editing or regenerating keeps the old path in the archive.",
                  },
                ].map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.title} className="flex gap-2.5">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-sm border border-border bg-background/40 font-mono text-[9px] text-primary">
                        0{index + 1}
                      </span>
                      <div>
                        <p className="flex items-center gap-1 text-xs font-medium">
                          <Icon className="size-3 text-primary" aria-hidden />
                          {item.title}
                        </p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                          {item.copy}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Surface>

            <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
              Read more in the{" "}
              <Link href="/help" className="font-medium text-primary hover:underline">
                director&apos;s handbook
              </Link>
              .
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
