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
      className="space-y-4 px-4 py-10 sm:px-6"
    >
      <span className="sr-only">{label}</span>
      <div className="mx-auto max-w-4xl space-y-3">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
        <div className="grid gap-3 pt-2 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="space-y-3 rounded-xl border border-border bg-card p-3">
              <div className="flex items-center gap-3">
                <Skeleton className="size-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
