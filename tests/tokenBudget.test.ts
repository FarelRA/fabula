import { describe, expect, test } from "vitest";
import {
  computeUsable,
  estimateTokens,
  fitToBudget,
  systemTokenBudget,
  type Block,
} from "../convex/lib/tokenBudget";

const repeat = (char: string, n: number): string => char.repeat(n);

describe("token estimation + budget math", () => {
  test("estimates at chars/4, rounding up", () => {
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
    expect(estimateTokens("")).toBe(0);
  });

  test("usable context subtracts reserve and protocol overhead", () => {
    expect(computeUsable(10_000, 1_000)).toBe(10_000 - 1_000 - 512);
    expect(computeUsable(100, 200)).toBe(0);
  });

  test("system target is 25% of usable", () => {
    expect(systemTokenBudget(4_000)).toBe(1_000);
  });
});

describe("fitToBudget", () => {
  test("leaves an under-budget system untouched", () => {
    const blocks: Block[] = [
      { key: "contract", text: repeat("c", 400) },
      { key: "mode", text: repeat("m", 400) },
    ];
    const result = fitToBudget({
      blocks,
      context: [],
      contextWindow: 8_192,
      outputReserve: 1_024,
    });
    expect(result.overBudget).toBe(false);
    expect(result.shrunkBlocks).toEqual([]);
    expect(result.droppedContext).toBe(0);
    expect(result.blocks).toEqual(blocks);
  });

  test("drops oldest context first, then compacts memory", () => {
    const blocks: Block[] = [
      { key: "contract", text: repeat("c", 200) },
      { key: "mode", text: repeat("m", 200) },
      { key: "memory", text: repeat("x", 40_000) },
    ];
    const context: Block[] = Array.from({ length: 20 }, (_, i) => ({
      key: `beat-${i}`,
      text: repeat("y", 8_000),
    }));
    const result = fitToBudget({
      blocks,
      context,
      contextWindow: 2_048,
      outputReserve: 512,
    });
    expect(result.droppedContext).toBe(16); // 20 → min 4
    expect(result.context).toHaveLength(4);
    expect(result.shrunkBlocks).toContain("memory");
    expect(result.overBudget).toBe(false);
    expect(result.systemTokens).toBeLessThanOrEqual(result.targetTokens);
  });

  test("never shrinks contract/boundaries/director/mode blocks", () => {
    const protectedChars = 40_000;
    const blocks: Block[] = [
      { key: "contract", text: repeat("c", protectedChars) },
      { key: "boundaries", text: repeat("b", protectedChars) },
      { key: "directorNotes", text: repeat("d", protectedChars) },
      { key: "mode", text: repeat("m", protectedChars) },
      { key: "memory", text: repeat("x", 40_000) },
    ];
    const result = fitToBudget({
      blocks,
      context: [],
      contextWindow: 4_096,
      outputReserve: 1_024,
    });
    // Even shrinking memory to its floor cannot reach the target: flagged.
    expect(result.overBudget).toBe(true);
    const byKey = new Map(result.blocks.map((b) => [b.key, b]));
    expect(byKey.get("contract")?.text).toHaveLength(protectedChars);
    expect(byKey.get("boundaries")?.text).toHaveLength(protectedChars);
    expect(byKey.get("directorNotes")?.text).toHaveLength(protectedChars);
    expect(byKey.get("mode")?.text).toHaveLength(protectedChars);
    expect(result.shrunkBlocks).toContain("memory");
  });

  test("keeps at least minContextBeats unless shrinking cannot help", () => {
    const blocks: Block[] = [{ key: "contract", text: repeat("c", 200) }];
    const context: Block[] = Array.from({ length: 10 }, (_, i) => ({
      key: `beat-${i}`,
      text: repeat("y", 4_000),
    }));
    const result = fitToBudget({
      blocks,
      context,
      contextWindow: 32_000,
      outputReserve: 1_000,
    });
    expect(result.droppedContext).toBe(0); // system already under target
    expect(result.context).toHaveLength(10);
  });
});
