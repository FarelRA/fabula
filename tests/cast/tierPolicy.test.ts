import { describe, expect, test } from "vitest";
import {
  CAST_MAX,
  CAST_MIN,
  castSizeHint,
  clampCastSize,
  modelTierFor,
  tierDefaultsForSize,
  tierForPosition,
} from "@/lib/cast/tierPolicy";

/**
 * Cast sizing policy (PLAN §7.4 constraint 5 / Phase 4.5):
 * ≤4 all spotlight · 5–6 max 4 spotlight · 7–8 max 3 spotlight, 2 supporting.
 */

describe("tierDefaultsForSize", () => {
  test.each([
    [1, ["spotlight"]],
    [2, ["spotlight", "spotlight"]],
    [3, ["spotlight", "spotlight", "spotlight"]],
    [4, ["spotlight", "spotlight", "spotlight", "spotlight"]],
    [5, ["spotlight", "spotlight", "spotlight", "spotlight", "supporting"]],
    [6, ["spotlight", "spotlight", "spotlight", "spotlight", "supporting", "supporting"]],
    [7, ["spotlight", "spotlight", "spotlight", "supporting", "supporting", "background", "background"]],
    [8, ["spotlight", "spotlight", "spotlight", "supporting", "supporting", "background", "background", "background"]],
  ] as const)("size %i", (size, expected) => {
    expect(tierDefaultsForSize(size)).toEqual(expected);
  });

  test("clamps out-of-range and fractional sizes", () => {
    expect(tierDefaultsForSize(0)).toHaveLength(CAST_MIN);
    expect(tierDefaultsForSize(99)).toHaveLength(CAST_MAX);
    expect(tierDefaultsForSize(3.6)).toHaveLength(4);
    expect(clampCastSize(-2)).toBe(CAST_MIN);
    expect(clampCastSize(42)).toBe(CAST_MAX);
  });

  test("tierForPosition falls back to background", () => {
    expect(tierForPosition(3, 0)).toBe("spotlight");
    expect(tierForPosition(3, 9)).toBe("background");
  });
});

describe("modelTierFor", () => {
  test("maps spotlight/supporting/background to model tiers", () => {
    expect(modelTierFor("spotlight")).toBe("spotlight");
    expect(modelTierFor("supporting")).toBe("standard");
    expect(modelTierFor("background")).toBe("cheap");
  });
});

describe("castSizeHint", () => {
  test("stays silent at the recommended sizes", () => {
    expect(castSizeHint(1)).toBeNull();
    expect(castSizeHint(4)).toBeNull();
  });

  test("explains strict turn-taking at 5+", () => {
    expect(castSizeHint(5)).toMatch(/strict turn-taking/i);
    expect(castSizeHint(8)).toMatch(/background roles speak only/i);
  });
});
