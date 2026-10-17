// @vitest-environment edge-runtime
import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { DEFAULT_TEMPLATES } from "../../convex/prompts/templates";
import { renderTemplate, stableHash, templateVars } from "../../convex/prompts/registry";
import { makeT } from "./helpers";

describe("prompt template registry (pure)", () => {
  test("stableHash is deterministic and sensitive", () => {
    expect(stableHash("abc")).toBe(stableHash("abc"));
    expect(stableHash("abc")).not.toBe(stableHash("abd"));
  });

  test("renderTemplate substitutes known vars and leaves unknown ones visible", () => {
    expect(renderTemplate("Hello {{name}}!", { name: "Linh" })).toBe("Hello Linh!");
    expect(renderTemplate("Hi {{missing}}", {})).toBe("Hi {{missing}}");
  });

  test("templateVars extracts sorted placeholder names", () => {
    expect(templateVars("{{b}} {{a}} {{a}}")).toEqual(["a", "b"]);
  });

  test("every default template declares variables and content", () => {
    for (const template of DEFAULT_TEMPLATES) {
      expect(template.key.length).toBeGreaterThan(0);
      expect(template.content.length).toBeGreaterThan(0);
      expect(template.vars.length).toBeGreaterThan(0);
    }
  });

  test("template keys are unique", () => {
    const keys = DEFAULT_TEMPLATES.map((template) => template.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("template seeding (integration)", () => {
  test("seedV1 is idempotent and activates every template", async () => {
    const t = makeT();
    const first = await t.mutation(api.prompts.seed.seedV1, {});
    expect(first.inserted).toBe(DEFAULT_TEMPLATES.length);
    expect(first.active).toBe(DEFAULT_TEMPLATES.length);

    const second = await t.mutation(api.prompts.seed.seedV1, {});
    expect(second.inserted).toBe(0);
    expect(second.active).toBe(DEFAULT_TEMPLATES.length);

    const active = await t.query(api.prompts.seed.listActive, {});
    expect(active).toHaveLength(DEFAULT_TEMPLATES.length);
    expect(active.map((row) => row.key)).toEqual(
      [...DEFAULT_TEMPLATES.map((template) => template.key)].sort(),
    );
  });
});
