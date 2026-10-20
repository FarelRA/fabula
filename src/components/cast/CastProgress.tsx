"use client";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Casting progress: progressive skeletons while the cast
 * is generated. The opening beat is drafted right after the cast, so this
 * surface is the bridge between premise and audition.
 */
export function CastProgress({ label = "Casting the troupe…" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="stage-haze min-h-[60dvh]"
    >
      <span className="sr-only">{label}</span>
      <div className="studio-shell py-12 sm:py-16">
        <div className="mx-auto max-w-4xl space-y-4">
          <div className="space-y-2 border-b border-border/60 pb-5">
            <p className="cue flex items-center gap-2 text-primary">
              <span className="size-1.5 animate-pulse rounded-full bg-primary motion-reduce:animate-none" aria-hidden />
              The company is assembling
            </p>
            <Skeleton className="h-9 w-72 max-w-full" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
          <div className="grid gap-3 pt-2 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <div
                key={index}
                className="space-y-3 rounded-lg border border-border/60 bg-card/60 p-4"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="size-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
                <Skeleton className="h-20 w-full" />
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
    </div>
  );
}
