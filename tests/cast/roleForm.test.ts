import { describe, expect, test } from "vitest";
import { blankRoleCard } from "@/lib/cast/roles";
import {
  cardFromRoleValues,
  roleFormSchema,
  roleValuesFromCard,
} from "@/lib/cast/roleForm";

/** Role editor form (Phase 4.2): round-trips through the frozen contract. */

describe("roleFormSchema", () => {
  test("accepts values derived from a valid card", () => {
    const card = blankRoleCard(0);
    const values = roleValuesFromCard(card);
    expect(roleFormSchema.safeParse(values).success).toBe(true);
  });

  test("rejects empty names and hooks", () => {
    const values = roleValuesFromCard(blankRoleCard(0));
    expect(roleFormSchema.safeParse({ ...values, name: "" }).success).toBe(false);
    expect(roleFormSchema.safeParse({ ...values, hook: "  " }).success).toBe(false);
  });

  test("clamps dials to 0–1", () => {
    const values = roleValuesFromCard(blankRoleCard(0));
    expect(roleFormSchema.safeParse({ ...values, warmth: 1.2 }).success).toBe(false);
    expect(roleFormSchema.safeParse({ ...values, warmth: 1 }).success).toBe(true);
  });
});

describe("cardFromRoleValues", () => {
  test("round-trips the editable card", () => {
    const base = blankRoleCard(0);
    const values = roleValuesFromCard(base);
    const next = cardFromRoleValues(
      {
        ...values,
        name: "Linh",
        hook: "Collects debts she can never repay herself.",
        traits: "patient, watchful",
        accentColor: "violet",
        warmth: 0.25,
        storyRole: "antagonist",
        tier: "background",
      },
      base,
    );
    expect(next.identity.name).toBe("Linh");
    expect(next.identity.accentColor).toBe("violet");
    expect(next.hook).toContain("never repay");
    expect(next.psychology.traits).toEqual(["patient", "watchful"]);
    expect(next.psychology.dials.warmth).toBe(0.25);
    expect(next.meta.storyRole).toBe("antagonist");
    expect(next.meta.tier).toBe("background");
    expect(next.meta.modelTier).toBe("cheap");
  });

  test("preserves the cached sample lines and fills an empty voice", () => {
    const base = blankRoleCard(0);
    const values = roleValuesFromCard(base);
    const next = cardFromRoleValues(values, {
      ...base,
      voice: { ...base.voice, sampleLines: [] },
    });
    expect(next.voice.sampleLines.length).toBeGreaterThanOrEqual(2);
  });

  test("splits comma lists and newline boundaries", () => {
    const base = blankRoleCard(0);
    const values = roleValuesFromCard(base);
    const next = cardFromRoleValues(
      {
        ...values,
        verbalTics: "taps twice, checks the door",
        boundariesLines: "Won't lie\nWon't steal",
      },
      base,
    );
    expect(next.voice.verbalTics).toEqual(["taps twice", "checks the door"]);
    expect(next.boundariesLines).toEqual(["Won't lie", "Won't steal"]);
  });
});
