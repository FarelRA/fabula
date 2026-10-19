import { describe, expect, test } from "vitest";
import { z } from "zod";
import {
  CastingSchema,
  FieldRegenSchema,
  RoleCardSchema,
} from "../convex/shared/contracts";
import {
  isStrictCompatible,
  stripOptionalNulls,
  toStrictJsonSchema,
} from "../convex/lib/strictJsonSchema";
import { makeRoleCard } from "./factories";

/**
 * Strict structured outputs: zod marks `.optional()` keys by omitting them
 * from `required`, which providers with strict JSON schemas reject (the
 * production casting call failed on `roles[].meta.temperature`). The rewrite
 * requires every key and makes optional ones nullable; the cleaner turns
 * those nulls back into absence before zod validation.
 */

type JsonNode = Record<string, unknown>;

const node = (value: unknown): JsonNode => value as JsonNode;

const strictOf = (schema: z.ZodType): JsonNode =>
  toStrictJsonSchema(z.toJSONSchema(schema, { io: "output" })) as JsonNode;

describe("toStrictJsonSchema", () => {
  test("requires every key and marks optional ones nullable", () => {
    const strict = strictOf(
      z.object({
        name: z.string(),
        meta: z.object({ tier: z.string(), temperature: z.number().optional() }),
      }),
    );
    expect(strict.required).toEqual(["name", "meta"]);
    expect(strict.additionalProperties).toBe(false);
    const meta = node(node(strict.properties).meta);
    expect(meta.required).toEqual(["tier", "temperature"]);
    expect(node(meta.properties).temperature).toMatchObject({
      type: ["number", "null"],
    });
    expect(meta.additionalProperties).toBe(false);
  });

  test("the role card schema drops the reported casting failure", () => {
    const strict = strictOf(RoleCardSchema);
    const meta = node(node(strict.properties).meta);
    expect(meta.required).toEqual(["storyRole", "tier", "modelTier", "temperature"]);
    expect(node(meta.properties).temperature).toMatchObject({
      type: ["number", "null"],
    });
  });

  test("optional enums become an anyOf with null instead of a type union", () => {
    const strict = strictOf(z.object({ kind: z.enum(["a", "b"]).optional() }));
    expect(strict.required).toEqual(["kind"]);
    expect(node(strict.properties).kind).toEqual({
      anyOf: [{ type: "string", enum: ["a", "b"] }, { type: "null" }],
    });
  });
});

describe("stripOptionalNulls", () => {
  test("a null optional key reads back as absent and still validates", () => {
    const card = makeRoleCard();
    const strict = strictOf(CastingSchema);
    const value = {
      premise: "A cozy evening in Bantul.",
      roles: [{ ...card, meta: { ...card.meta, temperature: null } }],
    };
    const cleaned = stripOptionalNulls(strict, value) as {
      roles: Array<{ meta: JsonNode }>;
    };
    const meta = cleaned.roles[0]?.meta ?? {};
    expect("temperature" in meta).toBe(false);
    expect(CastingSchema.safeParse(cleaned).success).toBe(true);
  });

  test("concrete optional values survive", () => {
    const card = makeRoleCard();
    const strict = strictOf(CastingSchema);
    const value = {
      premise: "A cozy evening in Bantul.",
      roles: [{ ...card, meta: { ...card.meta, temperature: 0.9 } }],
    };
    const cleaned = stripOptionalNulls(strict, value) as {
      roles: Array<{ meta: { temperature?: number } }>;
    };
    expect(cleaned.roles[0]?.meta.temperature).toBe(0.9);
    expect(CastingSchema.safeParse(cleaned).success).toBe(true);
  });

  test("nulls the schema does not mark optional are left for zod to reject", () => {
    const card = makeRoleCard();
    const strict = strictOf(RoleCardSchema);
    const cleaned = stripOptionalNulls(strict, { ...card, hook: null }) as {
      hook: unknown;
    };
    expect(cleaned.hook).toBeNull();
    expect(RoleCardSchema.safeParse(cleaned).success).toBe(false);
  });
});

describe("isStrictCompatible", () => {
  test("object schemas are compatible, free-form records are not", () => {
    expect(isStrictCompatible(strictOf(CastingSchema))).toBe(true);
    expect(isStrictCompatible(strictOf(RoleCardSchema))).toBe(true);
    expect(isStrictCompatible(z.toJSONSchema(FieldRegenSchema, { io: "output" }))).toBe(
      false,
    );
  });
});
