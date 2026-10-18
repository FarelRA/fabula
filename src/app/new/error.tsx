"use client";

import { useEffect } from "react";
import { RouteError } from "@/components/shell/RouteError";

/**
 * Casting-flow boundary (Phase 8.3): /new, wizard, quick start and templates.
 * Drafts and locks live server-side — retrying never loses them.
 */
export default function NewSceneError({
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
      title="The casting room hit a snag"
      description="Your premise and cast drafts are safe. Try again — everything you typed is still here."
      onRetry={reset}
    />
  );
}
