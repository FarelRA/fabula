"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { MotionConfig } from "motion/react";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * App-wide providers (Phase 3):
 *  - next-themes: dark-first, light available; class strategy on <html>
 *  - MotionConfig reducedMotion="user": honors prefers-reduced-motion everywhere
 *  - ConvexProvider: reactive data layer (only when the deployment URL is set;
 *    fixtures/dev rendering still works without a backend)
 *  - Radix TooltipProvider + sonner toasts
 */

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

export function Providers({ children }: { children: ReactNode }) {
  const tree = (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <MotionConfig reducedMotion="user">
        <TooltipProvider delayDuration={300}>
          {children}
          <Toaster position="bottom-right" />
        </TooltipProvider>
      </MotionConfig>
    </ThemeProvider>
  );

  if (!convex) return tree;
  return <ConvexProvider client={convex}>{tree}</ConvexProvider>;
}
