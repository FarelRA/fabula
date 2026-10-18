"use client";

import { useEffect } from "react";
import { RouteError } from "@/components/shell/RouteError";

/**
 * Shared-scene boundary: a visitor's link failed to render. The
 * scene itself is untouched, this is a screen problem, not a story problem.
 */
export default function ShareError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <RouteError
      title="This shared scene could not open"
      description="The connection to the scene failed. Nothing about the story changed. Try again."
      onRetry={reset}
      homeHref="/"
      homeLabel="Start your own scene"
    />
  );
}
