import { describe, expect, test } from "vitest";
import { dedupeFactCandidates, isDuplicateFact } from "../../convex/domain/factDedupe";

describe("isDuplicateFact", () => {
  test("detects normalized-exact duplicates", () => {
    expect(isDuplicateFact("The ledger is real.", ["the  ledger is real."])).toBe(true);
  });

  test("detects near-duplicates by token overlap", () => {
    expect(
      isDuplicateFact("The ledger changed hands at dawn.", [
        "At dawn the ledger changed hands.",
      ]),
    ).toBe(true);
  });

  test("keeps genuinely new facts", () => {
    expect(
      isDuplicateFact("The widow keeps a revolver under the counter.", [
        "The ledger changed hands at dawn.",
      ]),
    ).toBe(false);
  });

  test("an empty ledger never duplicates", () => {
    expect(isDuplicateFact("Anything at all.", [])).toBe(false);
  });
});

describe("dedupeFactCandidates", () => {
  test("drops duplicates against the ledger and against each other", () => {
    const kept = dedupeFactCandidates(
      [
        "The ledger changed hands at dawn.",
        "At dawn the ledger changed hands.", // dup of the previous candidate
        "The widow keeps a revolver.",
        "The ledger is real.", // dup of existing
      ],
      ["The ledger is real."],
    );
    expect(kept).toEqual([
      "The ledger changed hands at dawn.",
      "The widow keeps a revolver.",
    ]);
  });
});
