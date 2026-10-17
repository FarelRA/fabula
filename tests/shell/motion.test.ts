import { describe, expect, test } from "vitest";
import {
  DEFAULT_TRANSITION,
  fadeVariants,
  resolveTransition,
  resolveVariants,
  riseVariants,
} from "@/lib/motion";

/**
 * Motion presets (Phase 3.3, PLAN §9.8): every animated surface must honor
 * prefers-reduced-motion — reduced mode keeps the end state, drops movement.
 */

describe("resolveTransition", () => {
  test("reduced motion collapses to instant", () => {
    expect(resolveTransition(true)).toEqual({ duration: 0 });
  });

  test("full motion uses the shared default", () => {
    expect(resolveTransition(false)).toBe(DEFAULT_TRANSITION);
  });

  test("custom base transitions resolve through", () => {
    const base = { duration: 0.5, ease: "easeIn" as const };
    expect(resolveTransition(false, base)).toBe(base);
    expect(resolveTransition(true, base)).toEqual({ duration: 0 });
  });
});

describe("resolveVariants", () => {
  test("reduced motion keeps only the end state (no movement)", () => {
    const reduced = resolveVariants(true, riseVariants);
    expect(reduced.hidden).toEqual(riseVariants.visible);
    expect(reduced.visible).toEqual(riseVariants.visible);
  });

  test("full motion passes variants through untouched", () => {
    expect(resolveVariants(false, riseVariants)).toBe(riseVariants);
    expect(resolveVariants(false, fadeVariants)).toBe(fadeVariants);
  });

  test("presets animate opacity for safe fades", () => {
    expect(fadeVariants.hidden).toEqual({ opacity: 0 });
    expect(fadeVariants.visible).toEqual({ opacity: 1 });
  });
});
