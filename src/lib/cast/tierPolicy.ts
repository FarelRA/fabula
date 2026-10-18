import type { ModelTier, Tier } from "@convex/shared/contracts";

/**
 * Cast sizing policy (PLAN §7.4 constraint 5 / Phase 4.5):
 *
 *   ≤ 4 roles → all spotlight
 *   5–6      → max 4 spotlight, rest supporting
 *   7–8      → max 3 spotlight, 2 supporting, rest background
 *
 * The same table drives the UI hint and the tier defaults applied when the
 * director changes the cast size.
 */

export const CAST_MIN = 1;
export const CAST_MAX = 8;
export const CAST_RECOMMENDED_MAX = 4;

function clampSize(size: number): number {
  if (!Number.isFinite(size)) return CAST_MIN;
  return Math.min(CAST_MAX, Math.max(CAST_MIN, Math.round(size)));
}

export function tierDefaultsForSize(size: number): Tier[] {
  const total = clampSize(size);
  const spotlight = total <= 4 ? total : total <= 6 ? 4 : 3;
  const supporting = total <= 4 ? 0 : total <= 6 ? total - 4 : 2;
  const tiers: Tier[] = [
    ...Array.from({ length: spotlight }, () => "spotlight" as const),
    ...Array.from({ length: supporting }, () => "supporting" as const),
  ];
  while (tiers.length < total) tiers.push("background");
  return tiers;
}

export function tierForPosition(size: number, index: number): Tier {
  return tierDefaultsForSize(size)[index] ?? "background";
}

export function modelTierFor(tier: Tier): ModelTier {
  if (tier === "spotlight") return "spotlight";
  if (tier === "supporting") return "standard";
  return "cheap";
}

/** Inline explanation shown at ≥ 5 (never a modal, PLAN §9.5). */
export function castSizeHint(size: number): string | null {
  if (size < 5) return null;
  return "5+ roles switch to strict turn-taking: supporting and background roles speak only when addressed or affected, and cost roughly doubles.";
}

export function clampCastSize(size: number): number {
  return clampSize(size);
}
