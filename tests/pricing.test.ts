import { afterEach, describe, expect, test } from "vitest";
import { estimateCostUsd, priceFor } from "../convex/lib/pricing";

afterEach(() => {
  delete process.env.FABULA_PRICING_JSON;
});

describe("pricing", () => {
  test("computes cost from the default table", () => {
    expect(estimateCostUsd("openai/gpt-4.1", 1_000_000, 1_000_000)).toBe(10);
    expect(estimateCostUsd("openai/gpt-4.1-nano", 500_000, 0)).toBe(0.05);
  });

  test("falls back for unknown models", () => {
    const price = priceFor("someone/mystery-model");
    expect(price).toEqual({ input: 3, output: 12 });
    expect(estimateCostUsd("someone/mystery-model", 1_000_000, 1_000_000)).toBe(15);
  });

  test("honors FABULA_PRICING_JSON overrides", () => {
    process.env.FABULA_PRICING_JSON = JSON.stringify({
      "custom/model": { in: 1, out: 2 },
    });
    expect(priceFor("custom/model")).toEqual({ input: 1, output: 2 });
    expect(estimateCostUsd("custom/model", 1_000_000, 1_000_000)).toBe(3);
    // Overrides win over defaults too.
    process.env.FABULA_PRICING_JSON = JSON.stringify({
      "openai/gpt-4.1": { in: 0, out: 0 },
    });
    expect(estimateCostUsd("openai/gpt-4.1", 5_000_000, 5_000_000)).toBe(0);
  });

  test("ignores malformed overrides", () => {
    process.env.FABULA_PRICING_JSON = "{not json";
    expect(priceFor("openai/gpt-4.1")).toEqual({ input: 2, output: 8 });
  });

  test("rounds to 6 decimals", () => {
    const cost = estimateCostUsd("openai/gpt-4.1-nano", 1, 1);
    expect(cost.toString().split(".")[1]?.length ?? 0).toBeLessThanOrEqual(6);
  });
});
