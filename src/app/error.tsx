"use client";

import { useEffect } from "react";
import { RouteError } from "@/components/shell/RouteError";

/**
 * Root route boundary (Phase 8.3): catches render errors on any page that
 * doesn't have a closer boundary. The root *layout* itself is covered by
 * global-error.tsx; this one renders inside the app shell.
 */
export default function RootRouteError({
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
      title="Something went wrong on this page"
      description="Your scenes were not touched — this screen failed to render. Try again, or head back to the lobby."
      onRetry={reset}
    />
  );
}
