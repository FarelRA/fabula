"use client";

import { useEffect, useState } from "react";
import type { Platform } from "@/lib/keymap";

/** Best-effort platform detection for key hints; defaults to non-Mac for SSR. */
export function usePlatform(): Platform {
  const [platform, setPlatform] = useState<Platform>("other");

  useEffect(() => {
    const source = `${navigator.platform ?? ""} ${navigator.userAgent ?? ""}`;
    setPlatform(/mac|iphone|ipad|ipod/i.test(source) ? "mac" : "other");
  }, []);

  return platform;
}
