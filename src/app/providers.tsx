"use client";

import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { MotionConfig } from "motion/react";
import { ThemeProvider } from "next-themes";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * App-wide providers:
 *  - next-themes: dark-first, light available; class strategy on <html>
 *  - MotionConfig reducedMotion="user": honors prefers-reduced-motion everywhere
 *  - Convex Auth: anonymous sessions; reactive data layer when a deployment URL exists
 *  - nuqs: URL state for the wizard/inspector
 *  - Radix TooltipProvider + sonner toasts
 */

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

export function Providers({ children }: { children: ReactNode }) {
  const tree = (
    <NuqsAdapter>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
        <MotionConfig reducedMotion="user">
          <TooltipProvider delayDuration={300}>
            {children}
            <Toaster position="bottom-right" />
          </TooltipProvider>
        </MotionConfig>
      </ThemeProvider>
    </NuqsAdapter>
  );

  if (!convex) return tree;
  return <ConvexAuthProvider client={convex}>{tree}</ConvexAuthProvider>;
}
