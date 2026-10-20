import Link from "next/link";
import {
  ArrowRightIcon,
  BookOpenIcon,
  ListOrderedIcon,
  ZapIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Surface } from "@/components/ui/surface";

const DOORS = [
  {
    href: "/new/quick",
    icon: ZapIcon,
    title: "Quick start",
    tagline: "One line, then play",
    description:
      "Give us a premise. We cast a coherent troupe and draft the opening beat while you watch. Edit anyone before the curtain rises.",
    points: ["Three screens to play", "Audition-lite review", "Director from the start"],
    meta: "About a minute",
    recommended: false,
  },
  {
    href: "/new/wizard",
    icon: ListOrderedIcon,
    title: "Guided setup",
    tagline: "Four steps to the room",
    description:
      "Premise, world and tone, whether you are in the scene, then cast size. The deliberate path for a director with a shape in mind.",
    points: ["Tone dials", "Presentation style", "Human role editor"],
    meta: "Two to three minutes",
    recommended: true,
  },
  {
    href: "/new/templates",
    icon: BookOpenIcon,
    title: "Templates",
    tagline: "Six worlds, ready to enter",
    description:
      "Noir, court intrigue, a space crew, a conservatory, a crossroads tavern, or a duel of letters. Every seed is editable.",
    points: ["Premise and tone", "Cast skeleton", "The same audition room"],
    meta: "Browse at your pace",
    recommended: false,
  },
] as const;

/** The three doors. All three converge on one audition room. */
export function ThreeDoors() {
  return (
    <ul className="grid gap-4 lg:grid-cols-3">
      {DOORS.map((door, index) => {
        const Icon = door.icon;
        return (
          <li key={door.href}>
            <Surface
              tone={door.recommended ? "glow" : "raised"}
              padding="none"
              className="group flex h-full flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-border/70 px-4 py-2.5">
                <span className="cue text-[0.6rem] text-muted-foreground">
                  Door {String(index + 1).padStart(2, "0")}
                </span>
                {door.recommended ? (
                  <Badge variant="outline" className="border-primary/30 text-primary">
                    Recommended
                  </Badge>
                ) : (
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {door.meta}
                  </span>
                )}
              </div>

              <div className="flex flex-1 flex-col p-5">
                <span className="flex size-10 items-center justify-center rounded-sm border border-primary/25 bg-primary/10 text-primary transition-colors group-hover:border-primary/50">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div className="mt-4">
                  <p className="cue text-[0.6rem] text-primary">{door.tagline}</p>
                  <h2 className="mt-1.5 font-serif text-2xl leading-tight">
                    {door.title}
                  </h2>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {door.description}
                </p>
                <ul className="mt-5 space-y-0 border-y border-border/60">
                  {door.points.map((point) => (
                    <li
                      key={point}
                      className="flex items-center gap-2 border-b border-border/40 py-1.5 text-xs text-muted-foreground last:border-b-0"
                    >
                      <span className="size-1 rounded-full bg-primary/80" aria-hidden />
                      {point}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto flex items-center justify-between gap-2 pt-5">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {door.meta}
                  </span>
                  <Link
                    href={door.href}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                  >
                    Open this door
                    <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                </div>
              </div>
            </Surface>
          </li>
        );
      })}
    </ul>
  );
}
