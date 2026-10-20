"use client";

import dynamic from "next/dynamic";
import { CastProgress } from "@/components/cast/CastProgress";

/**
 * Lazy boundary for the shared-scene shell: keeps the share route's initial
 * JS small (the shell pulls in the thread renderer + streaming transport).
 */
const ShareShell = dynamic(
  () => import("@/components/share/ShareShell").then((module) => module.ShareShell),
  {
    ssr: false,
    loading: () => <CastProgress label="Opening the shared scene…" />,
  },
);

export function SharePageClient({ token }: { token: string }) {
  return <ShareShell token={token} />;
}
