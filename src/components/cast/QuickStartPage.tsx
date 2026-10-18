"use client";

import { CastSessionProvider } from "@/lib/cast/session";
import { QuickStartForm } from "@/components/cast/QuickStartForm";

export function QuickStartPage({ initialSceneId }: { initialSceneId?: string }) {
  return (
    <CastSessionProvider initialSceneId={initialSceneId}>
      <QuickStartForm />
    </CastSessionProvider>
  );
}
