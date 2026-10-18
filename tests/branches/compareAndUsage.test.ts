import { describe, expect, test } from "vitest";
import { alignBranches, type CompareBeat } from "@/lib/branches/compare";
import {
  budgetState,
  formatTokens,
  formatUsd,
  normalizeByTier,
} from "@/lib/usage/format";

function compareBeat(
  depth: number,
  text: string,
  overrides: Partial<CompareBeat> = {},
): CompareBeat {
  return {
    id: `b${depth}`,
    seq: depth + 1,
    depth,
    text,
    speakerName: "Linh",
    origin: "turn",
    status: "finished",
    ...overrides,
  };
}

describe("branch compare alignment", () => {
  test("aligns beats by depth and flags divergence", () => {
    const left = [compareBeat(0, "Open on rain"), compareBeat(1, "She knocks")];
    const right = [compareBeat(0, "Open on rain"), compareBeat(1, "He knocks")];
    const rows = alignBranches(left, right);
    expect(rows.map((row) => row.depth)).toEqual([0, 1]);
    expect(rows[0]?.divergence).toBe(false);
    expect(rows[1]?.divergence).toBe(true);
    expect(rows[1]?.left?.text).toBe("She knocks");
    expect(rows[1]?.right?.text).toBe("He knocks");
  });

  test("missing sides are divergence rows, not padding", () => {
    const left = [compareBeat(0, "One"), compareBeat(1, "Two"), compareBeat(2, "Three")];
    const right = [compareBeat(0, "One")];
    const rows = alignBranches(left, right);
    expect(rows).toHaveLength(3);
    expect(rows[1]?.right).toBeUndefined();
    expect(rows[1]?.divergence).toBe(true);
    expect(rows[2]?.left?.text).toBe("Three");
  });
});

describe("usage formatting & budget policy", () => {
  test("normalizes the v.any byTier rollup defensively", () => {
    expect(
      normalizeByTier({
        spotlight: { tokensIn: 120, tokensOut: 80, costEstimateUsd: 0.004 },
        cheap: { tokensIn: 10, tokensOut: 10, costEstimateUsd: 0.0001 },
        junk: null,
      }),
    ).toEqual([
      { tier: "spotlight", tokensIn: 120, tokensOut: 80, costEstimateUsd: 0.004 },
      { tier: "cheap", tokensIn: 10, tokensOut: 10, costEstimateUsd: 0.0001 },
    ]);
    expect(normalizeByTier(null)).toEqual([]);
    expect(normalizeByTier({ empty: { tokensIn: 0, tokensOut: 0, costEstimateUsd: 0 } })).toEqual(
      [],
    );
  });

  test("formats tokens and USD for humans", () => {
    expect(formatTokens(0)).toBe("0");
    expect(formatTokens(950)).toBe("950");
    expect(formatTokens(12_400)).toBe("12.4k");
    expect(formatTokens(2_100_000)).toBe("2.1M");
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(0.004)).toBe("<$0.01");
    expect(formatUsd(1.234)).toBe("$1.23");
  });

  test("warns at 80% and over at 100% of the soft cap", () => {
    expect(budgetState(0.2, undefined).level).toBe("none");
    expect(budgetState(0.1, 1).level).toBe("ok");
    const warn = budgetState(0.85, 1);
    expect(warn.level).toBe("warn");
    expect(warn.label).toContain("85%");
    const over = budgetState(1.4, 1);
    expect(over.level).toBe("over");
    expect(over.label).toContain("over budget");
  });
});
