import { describe, expect, test } from "vitest";
import { BREAKPOINTS, layoutForWidth, LAYOUT_MEDIA } from "@/lib/layout";

/**
 * Responsive layout matrix (PLAN §9.7 / Phase 3.2):
 *  - ≤ 768px → single pane
 *  - ≥ 769px → two panes
 *  - ≥ 1201px → three panes (desktop / ultrawide)
 */

describe("layoutForWidth", () => {
  test.each([
    [320, "single"], // phone portrait (design floor)
    [480, "single"],
    [767, "single"],
    [768, "single"], // boundary stays single
    [769, "two"], // boundary tips to two panes
    [1024, "two"],
    [1200, "two"],
    [1201, "three"], // boundary tips to three panes
    [1440, "three"],
    [2560, "three"], // 21:9+ ultrawide keeps three panes
  ] as const)("%ipx → %s", (width, expected) => {
    expect(layoutForWidth(width)).toBe(expected);
  });

  test("breakpoint constants stay in the documented order", () => {
    expect(BREAKPOINTS.twoPane).toBe(769);
    expect(BREAKPOINTS.threePane).toBe(1201);
    expect(BREAKPOINTS.twoPane).toBeLessThan(BREAKPOINTS.threePane);
  });

  test("media queries match the breakpoints", () => {
    expect(LAYOUT_MEDIA.twoPane).toBe("(min-width: 769px)");
    expect(LAYOUT_MEDIA.threePane).toBe("(min-width: 1201px)");
  });
});
