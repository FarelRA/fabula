import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { GENRE_PRESETS, toneSummary } from "@/lib/cast/presets";

function roleLabel(storyRole: string): string {
  return storyRole.slice(0, 1).toUpperCase() + storyRole.slice(1);
}

/** Template gallery: six Appendix-A seeds, one click to setup. */
export function TemplateGallery() {
  return (
    <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {GENRE_PRESETS.map((preset) => (
        <li key={preset.id}>
          <article className="flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-4">
            <header className="space-y-1">
              <h2 className="font-serif text-xl leading-tight">{preset.name}</h2>
              <p className="text-xs text-muted-foreground">
                {toneSummary(preset.tone)} · {preset.castSize} roles ·{" "}
                {preset.presentationStyle}
              </p>
            </header>
            <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
              {preset.premise}
            </p>
            <div className="flex flex-wrap gap-1">
              {preset.skeleton.map((role) => (
                <Badge key={`${preset.id}-${role.storyRole}-${role.hook}`} variant="outline">
                  {roleLabel(role.storyRole)}
                </Badge>
              ))}
            </div>
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">Cast skeleton</summary>
              <ul className="mt-1.5 space-y-1">
                {preset.skeleton.map((role) => (
                  <li key={`${preset.id}-detail-${role.hook}`}>
                    <span className="text-foreground">{roleLabel(role.storyRole)}</span>
                    <span className="block text-muted-foreground">{role.hook}</span>
                  </li>
                ))}
              </ul>
            </details>
            <Link
              href={`/new/wizard?template=${preset.id}&step=cast`}
              className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Use this template
              <ArrowRightIcon className="size-3.5" aria-hidden />
            </Link>
          </article>
        </li>
      ))}
    </ul>
  );
}
