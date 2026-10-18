"use client";

import { useSyncExternalStore } from "react";
import { LAYOUT_MEDIA, type LayoutMode } from "@/lib/layout";

/**
 * Viewport mode from matchMedia. JS decides *which* panes exist
 * inline vs. in sheets; CSS still styles everything responsively.
 */

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const queries = [
    window.matchMedia(LAYOUT_MEDIA.twoPane),
    window.matchMedia(LAYOUT_MEDIA.threePane),
  ];
  for (const query of queries) query.addEventListener("change", onChange);
  return () => {
    for (const query of queries) query.removeEventListener("change", onChange);
  };
}

function getSnapshot(): LayoutMode {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "three";
  }
  const two = window.matchMedia(LAYOUT_MEDIA.twoPane).matches;
  const three = window.matchMedia(LAYOUT_MEDIA.threePane).matches;
  if (three) return "three";
  if (two) return "two";
  return "single";
}

/** Hydration renders the widest layout; the client re-computes immediately. */
function getServerSnapshot(): LayoutMode {
  return "three";
}

export function useViewportMode(): LayoutMode {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
