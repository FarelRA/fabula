"use client";

import { useEffect } from "react";
import { RouteError } from "@/components/shell/RouteError";

/** Play/archive scene boundary (Phase 8.3) — covers nested /archive too. */
export default function SceneError({
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
      title="This scene could not open"
      description="The room is still there — retry, or start from the lobby. Every branch and beat is safe."
      onRetry={reset}
    />
  );
}
