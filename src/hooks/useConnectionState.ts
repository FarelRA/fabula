"use client";

import { useEffect, useState } from "react";
import { useConvexConnectionState } from "convex/react";

/** Shared connection vocabulary for banners and mutation locks (PLAN §9.9). */
export type ConnectionState = "online" | "reconnecting" | "offline";

/**
 * Browser reachability + Convex websocket health, in that priority order.
 * `offline` = the device itself lost the network; `reconnecting` = the socket
 * dropped after having been established and is retrying (Convex owns backoff).
 * Mutating affordances lock only on `offline` — reconnecting mutations are
 * queued by the Convex client and delivered on resume.
 */
export function useConnectionState(): ConnectionState {
  const connection = useConvexConnectionState();
  const [browserOnline, setBrowserOnline] = useState(true);

  useEffect(() => {
    const update = () => setBrowserOnline(window.navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!browserOnline) return "offline";
  if (connection.hasEverConnected && !connection.isWebSocketConnected) {
    return "reconnecting";
  }
  return "online";
}
