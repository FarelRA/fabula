"use client";

import { useState } from "react";
import { UsersIcon } from "lucide-react";
import usePresence from "@convex-dev/presence/react";
import { api } from "@convex/_generated/api";

/**
 * Presence badge for shared scenes: the presence
 * component owns heartbeats + disconnects; the room is the share token. The
 * display name is stable per tab so reloads don't inflate the count.
 */
export function SharePresence({ roomToken }: { roomToken: string }) {
  const [viewerName] = useState(() => {
    if (typeof window === "undefined") return "Viewer";
    const key = `fabula-share-name:${roomToken}`;
    const existing = window.sessionStorage.getItem(key);
    if (existing) return existing;
    const name = `Guest ${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
    window.sessionStorage.setItem(key, name);
    return name;
  });
  const presenceState = usePresence(api.presence, roomToken, viewerName);

  const viewers = presenceState ?? [];
  if (viewers.length === 0) return null;

  return (
    <div
      data-testid="share-presence"
      aria-label={`${viewers.length} watching now`}
      className="flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-2 py-1 text-[11px] text-muted-foreground"
    >
      <UsersIcon className="size-3.5" aria-hidden />
      <span aria-hidden className="flex -space-x-1.5">
        {viewers.slice(0, 3).map((viewer) => (
          <span
            key={viewer.userId}
            title={viewer.name ?? viewer.userId}
            className="flex size-4 items-center justify-center rounded-full border border-border bg-primary/15 text-[8px] font-medium text-primary"
          >
            {(viewer.name ?? viewer.userId).slice(-2).toUpperCase()}
          </span>
        ))}
      </span>
      <span>{viewers.length} watching</span>
    </div>
  );
}
