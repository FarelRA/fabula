"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ErrorState } from "@/components/shell/states";

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
    <div className="mx-auto max-w-xl space-y-4 px-4 py-16">
      <ErrorState
        title="This scene could not open"
        description="The room is still there — retry, or start from the lobby."
        onRetry={reset}
      />
      <div className="text-center">
        <Link href="/" className="text-sm text-primary hover:underline">
          Back to the lobby
        </Link>
      </div>
    </div>
  );
}
