import { ROLE_ACCENTS } from "@/lib/cast/avatar";

/**
 * Branch accents reuse the 8-slot role palette (PLAN §5.1: `colorIndex` is a
 * stable accent for gutter/map). Helpers return CSS-variable strings so the
 * same color works in inline styles and React Flow.
 */

export function branchColor(index: number): string {
  const length = ROLE_ACCENTS.length;
  const slot = ((Math.trunc(index) % length) + length) % length;
  return `var(--role-${ROLE_ACCENTS[slot]})`;
}

export function branchColorSoft(index: number): string {
  return `color-mix(in oklab, ${branchColor(index)} 22%, transparent)`;
}
