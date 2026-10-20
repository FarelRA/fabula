import Link from "next/link";
import { ArrowRightIcon, SparklesIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Surface } from "@/components/ui/surface";
import { GENRE_PRESETS, toneSummary } from "@/lib/cast/presets";

function roleLabel(storyRole: string): string {
  return storyRole.slice(0, 1).toUpperCase() + storyRole.slice(1);
}

/** Template gallery: six Appendix-A seeds, one click to setup. */
export function TemplateGallery() {
  return (
    <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {GENRE_PRESETS.map((preset, index) => (
        <li key={preset.id}>
          <Surface
            tone="raised"
            padding="none"
            className="group flex h-full flex-col overflow-hidden"
          >
            <div className="relative flex h-44 items-end overflow-hidden border-b border-border/70 bg-[radial-gradient(circle_at_24%_16%,color-mix(in_oklab,var(--primary)_24%,transparent),transparent_58%),linear-gradient(150deg,var(--card),var(--background))] p-4">
              <div className="absolute inset-0 opacity-20 staff-lines" aria-hidden />
              <div
                aria-hidden
                className="absolute -right-12 -top-12 size-40 rounded-full border border-primary/15"
              />
              <div className="relative flex w-full items-end justify-between gap-3">
                <div>
                  <p className="cue text-[0.6rem] text-primary">
                    Volume {String(index + 1).padStart(2, "0")}
                  </p>
                  <h2 className="mt-1 font-serif text-2xl leading-tight text-foreground">
                    {preset.name}
                  </h2>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    {preset.castSize} roles · {preset.presentationStyle}
                  </p>
                </div>
                <span className="hidden size-8 items-center justify-center rounded-sm border border-primary/25 bg-primary/10 text-primary transition-colors group-hover:border-primary/50 sm:flex">
                  <SparklesIcon className="size-4" aria-hidden />
                </span>
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-3 p-4">
              <p className="text-[11px] font-medium tracking-[0.08em] text-primary uppercase">
                {toneSummary(preset.tone)}
              </p>
              <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                {preset.premise}
              </p>
              <div className="flex flex-wrap gap-1">
                {preset.skeleton.map((role) => (
                  <Badge
                    key={`${preset.id}-${role.storyRole}-${role.hook}`}
                    variant="outline"
                    className="font-normal"
                  >
                    {roleLabel(role.storyRole)}
                  </Badge>
                ))}
              </div>
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground">
                  Read the cast skeleton
                </summary>
                <ul className="mt-2 space-y-1.5 border-t border-border/60 pt-2">
                  {preset.skeleton.map((role) => (
                    <li key={`${preset.id}-detail-${role.hook}`}>
                      <span className="text-foreground">{roleLabel(role.storyRole)}</span>
                      <span className="block leading-relaxed text-muted-foreground">
                        {role.hook}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
              <Link
                href={`/new/wizard?template=${preset.id}&step=cast`}
                className="mt-auto inline-flex items-center gap-1.5 border-t border-border/60 pt-3 text-sm font-semibold text-primary hover:underline"
              >
                Use this template
                <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </div>
          </Surface>
        </li>
      ))}
    </ul>
  );
}
