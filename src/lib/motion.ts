import type { Transition, Variants } from "motion/react";

/**
 * Shared motion presets. Every component that animates
 * must pass the reduced-motion flag through these resolvers, or rely on the
 * app-level `MotionConfig reducedMotion="user"` (see src/app/providers.tsx).
 */

export const DEFAULT_TRANSITION: Transition = { duration: 0.2, ease: "easeOut" };

export const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

export const riseVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

export const popVariants: Variants = {
  hidden: { opacity: 0, scale: 0.98 },
  visible: { opacity: 1, scale: 1 },
};

export function resolveTransition(
  reduced: boolean,
  base: Transition = DEFAULT_TRANSITION,
): Transition {
  return reduced ? { duration: 0 } : base;
}

/** Reduced motion keeps the end state and drops the movement. */
export function resolveVariants(reduced: boolean, variants: Variants): Variants {
  if (!reduced) return variants;
  const end = variants.visible ?? {};
  return { hidden: end, visible: end };
}
