"use client";

import { useEffect, useState } from "react";
import { useConvexConnectionState } from "convex/react";

/** Shared connection vocabulary for banners and mutation locks. */
export type ConnectionState = "online" | "reconnecting" | "offline";

type RawConnection = {
  hasEverConnected: boolean;
  isWebSocketConnected: boolean;
};

/**
 * Convex-aware connection health when a deployment URL is configured.
 * Fixture and offline builds have no Convex client in the tree, so they
 * report a stable "never connected" state instead of throwing.
 */
function useConvexConnection(): RawConnection {
  return useConvexConnectionState();
}

function useOfflineConnection(): RawConnection {
  return { hasEverConnected: false, isWebSocketConnected: false };
}

const useRawConnection: () => RawConnection = process.env.NEXT_PUBLIC_CONVEX_URL
  ? useConvexConnection
  : useOfflineConnection;

/**
 * Browser reachability + Convex websocket health, in that priority order.
 * `offline` = the device itself lost the network; `reconnecting` = the socket
 * dropped after having been established and is retrying (Convex owns backoff).
 * Mutating affordances lock only on `offline`, reconnecting mutations are
 * queued by the Convex client and delivered on resume.
 */
export function useConnectionState(): ConnectionState {
  const connection = useRawConnection();
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
