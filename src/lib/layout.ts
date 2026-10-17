/**
 * Responsive layout matrix (PLAN §9.7, Phase 3.2):
 *
 *  - single  ≤ 768px  phone portrait, landscape, foldables (dense single column)
 *  - two     ≥ 769px  tablet: cast | thread (inspector slides over)
 *  - three   ≥ 1201px desktop / ultrawide: cast | thread | inspector
 */
export const BREAKPOINTS = { twoPane: 769, threePane: 1201 } as const;

export type LayoutMode = "single" | "two" | "three";

export function layoutForWidth(width: number): LayoutMode {
  if (width >= BREAKPOINTS.threePane) return "three";
  if (width >= BREAKPOINTS.twoPane) return "two";
  return "single";
}

export const LAYOUT_MEDIA = {
  twoPane: `(min-width: ${BREAKPOINTS.twoPane}px)`,
  threePane: `(min-width: ${BREAKPOINTS.threePane}px)`,
} as const;
