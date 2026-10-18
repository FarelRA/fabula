"use client";

import Link from "next/link";
import { ErrorState } from "@/components/shell/states";

/**
 * Shared frame for route-level error boundaries (PLAN §9.9, Phase 8.3):
 * consistent recovery copy, a retry wired to the boundary's `reset`, and a
 * way home. Each route supplies surface-appropriate wording — none of them
 * ever imply story data was lost.
 */
export function RouteError({
  title,
  description,
  onRetry,
  homeHref = "/",
  homeLabel = "Back to the lobby",
}: {
  title: string;
  description: string;
  onRetry?: () => void;
  homeHref?: string;
  homeLabel?: string;
}) {
  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-16">
      <ErrorState title={title} description={description} onRetry={onRetry} />
      <div className="text-center">
        <Link
          href={homeHref}
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          {homeLabel}
        </Link>
      </div>
    </div>
  );
}
