import { describe, expect, test } from "vitest";
import {
  CastingSchema,
  DirectorMetaSchema,
  FactsSchema,
  PathOptionsSchema,
  RoleCardSchema,
  SummarySchema,
} from "../convex/shared/contracts";
import { makeOption, makeRoleCard } from "./factories";

describe("role card contract", () => {
  test("accepts a complete role card", () => {
    const parsed = RoleCardSchema.parse(makeRoleCard());
    expect(parsed.identity.name).toBe("Linh");
  });

  test("rejects an empty hook", () => {
    const result = RoleCardSchema.safeParse(makeRoleCard({ hook: "" }));
    expect(result.success).toBe(false);
  });

  test("rejects out-of-range dials", () => {
    const card = makeRoleCard();
    card.psychology.dials.warmth = 2;
    const result = RoleCardSchema.safeParse(card);
    expect(result.success).toBe(false);
  });
});

describe("path options contract", () => {
  test("accepts 2–4 divergent options", () => {
    const parsed = PathOptionsSchema.parse({
      options: [
        makeOption(),
        makeOption({ label: "Wait outside", strategy: "deflect" }),
        makeOption({ label: "Reveal the ledger", strategy: "reveal" }),
      ],
    });
    expect(parsed.options).toHaveLength(3);
  });

  test("rejects a single option", () => {
    const result = PathOptionsSchema.safeParse({ options: [makeOption()] });
    expect(result.success).toBe(false);
  });

  test("rejects five options", () => {
    const result = PathOptionsSchema.safeParse({
      options: Array.from({ length: 5 }, (_, i) =>
        makeOption({ label: `Option ${i + 1}` }),
      ),
    });
    expect(result.success).toBe(false);
  });

  test("enforces 2–4 word labels", () => {
    const pair = (label: string) => ({
      options: [makeOption({ label }), makeOption({ label: "Wait outside" })],
    });
    expect(PathOptionsSchema.safeParse(pair("Go")).success).toBe(false);
    expect(PathOptionsSchema.safeParse(pair("Push the door open wide")).success).toBe(false);
    expect(PathOptionsSchema.safeParse(pair("Push the door")).success).toBe(true);
  });

  test("rejects unknown strategies", () => {
    const result = PathOptionsSchema.safeParse({
      options: [makeOption({ strategy: "dance-around" })],
    });
    expect(result.success).toBe(false);
  });
});

describe("casting contract", () => {
  test("accepts a cast of 1–8 roles", () => {
    const parsed = CastingSchema.parse({
      premise: "A debt collector knocks on the wrong door.",
      roles: [makeRoleCard()],
    });
    expect(parsed.roles).toHaveLength(1);
  });

  test("rejects an empty cast and an oversized cast", () => {
    expect(CastingSchema.safeParse({ premise: "x", roles: [] }).success).toBe(false);
    expect(
      CastingSchema.safeParse({
        premise: "x",
        roles: Array.from({ length: 9 }, () => makeRoleCard()),
      }).success,
    ).toBe(false);
  });
});

describe("memory contracts", () => {
  test("summary requires ordered seq coverage", () => {
    expect(
      SummarySchema.safeParse({ summary: "The door opened.", coveredFromSeq: 1, coveredThroughSeq: 3 })
        .success,
    ).toBe(true);
    expect(
      SummarySchema.safeParse({ summary: "x", coveredFromSeq: 3, coveredThroughSeq: 1 }).success,
    ).toBe(false);
  });

  test("facts require visibility and nodeId", () => {
    expect(
      FactsSchema.safeParse({
        facts: [
          {
            text: "The ledger is real.",
            subjects: ["role_1"],
            visibility: "public",
            nodeId: "beat_1",
          },
        ],
      }).success,
    ).toBe(true);
    expect(
      FactsSchema.safeParse({ facts: [{ text: "x", subjects: [], nodeId: "beat_1" }] }).success,
    ).toBe(false);
  });

  test("director meta matches the schema", () => {
    expect(
      DirectorMetaSchema.safeParse({
        decisionPoint: true,
        reason: "A standoff is forming.",
        responders: ["role_1"],
        pacingNote: "Slow open, cut early.",
        endingSuggested: false,
      }).success,
    ).toBe(true);
  });
});
