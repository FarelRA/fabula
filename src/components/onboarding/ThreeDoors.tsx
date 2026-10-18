import Link from "next/link";
import { ArrowRightIcon, BookOpenIcon, ListOrderedIcon, ZapIcon } from "lucide-react";

const DOORS = [
  {
    href: "/new/quick",
    icon: ZapIcon,
    title: "Quick start",
    tagline: "One line, then play",
    description:
      "Give a premise. We cast a coherent troupe and draft the opening beat while you watch.",
    points: ["≤ 3 screens to play", "Audition-lite edits", "Director from the start"],
  },
  {
    href: "/new/wizard",
    icon: ListOrderedIcon,
    title: "Guided setup",
    tagline: "Four steps to the room",
    description:
      "Premise, world and tone, whether you're in the scene, then cast size. Nothing is generated until you say so.",
    points: ["Tone dials", "Presentation style", "Human role editor"],
  },
  {
    href: "/new/templates",
    icon: BookOpenIcon,
    title: "Templates",
    tagline: "Six genre seeds",
    description:
      "Noir, court intrigue, space crew, campus drama, cozy tavern, or a duel of letters, all preseeded and editable.",
    points: ["Premise + tone", "Cast skeleton", "Same audition"],
  },
] as const;

/** The three doors. All three converge on one audition. */
export function ThreeDoors() {
  return (
    <ul className="grid gap-3 md:grid-cols-3">
      {DOORS.map((door) => {
        const Icon = door.icon;
        return (
          <li key={door.href}>
            <Link
              href={door.href}
              className="group flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex size-10 items-center justify-center rounded-xl border border-border bg-muted text-primary">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="space-y-1">
                <span className="block font-heading text-lg font-semibold">{door.title}</span>
                <span className="block text-xs tracking-wide text-primary uppercase">
                  {door.tagline}
                </span>
              </span>
              <span className="text-sm leading-relaxed text-muted-foreground">
                {door.description}
              </span>
              <span className="mt-auto flex flex-wrap gap-1.5 pt-2">
                {door.points.map((point) => (
                  <span
                    key={point}
                    className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
                  >
                    {point}
                  </span>
                ))}
              </span>
              <span className="flex items-center gap-1 text-sm font-medium text-primary">
                Open
                <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
