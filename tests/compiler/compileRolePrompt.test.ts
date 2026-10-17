import { describe, expect, test } from "vitest";
import { compileRolePrompt } from "../../convex/compiler/compileRolePrompt";
import { renderTemplate } from "../../convex/prompts/registry";
import {
  beats,
  facts,
  model,
  notes,
  otherRole,
  relations,
  role,
  scene,
  summaries,
  templateMap,
} from "./fixtures";

const templates = templateMap();

function compileTurn(overrides: Partial<Parameters<typeof compileRolePrompt>[0]> = {}) {
  return compileRolePrompt({
    templates,
    role,
    scene,
    relations,
    facts,
    summaries,
    notes,
    contextBeats: beats(),
    mode: { kind: "turn" },
    model,
    contextWindow: 128_000,
    outputReserve: 800,
    ...overrides,
  });
}

describe("compileRolePrompt — golden snapshots", () => {
  test("turn · chat", () => {
    const result = compileTurn();
    expect(result.system).toMatchSnapshot();
    expect(result.messages).toMatchSnapshot();
  });

  test("turn · script", () => {
    const result = compileTurn({
      scene: { ...scene, presentationStyle: "script" },
    });
    expect(result.system).toMatchSnapshot();
  });

  test("turn · novel", () => {
    const result = compileTurn({
      scene: { ...scene, presentationStyle: "novel" },
    });
    expect(result.system).toMatchSnapshot();
  });

  test("options", () => {
    const result = compileTurn({
      mode: { kind: "options", count: 3, responderIds: [role.id, otherRole.id] },
    });
    expect(result.system).toMatchSnapshot();
  });

  test("sampleLine", () => {
    const result = compileTurn({ mode: { kind: "sampleLine" } });
    expect(result.system).toMatchSnapshot();
  });
});

describe("compileRolePrompt — purity", () => {
  test("identical inputs produce byte-identical outputs", () => {
    const first = compileTurn();
    const second = compileTurn();
    expect(second.system).toBe(first.system);
    expect(second.messages).toEqual(first.messages);
    expect(second.snapshot.blocks).toEqual(first.snapshot.blocks);
    expect(second.snapshot.tokenCounts).toEqual(first.snapshot.tokenCounts);
  });

  test("block order is fixed: contract → identity → world → boundaries → memory → relations → directorNotes → mode", () => {
    const result = compileTurn();
    expect(result.snapshot.blocks.map((block) => block.key)).toEqual([
      "contract",
      "identity",
      "world",
      "boundaries",
      "memory",
      "relations",
      "directorNotes",
      "mode",
    ]);
  });

  test("contract/boundaries/director/mode blocks never shrink under pressure", () => {
    const result = compileTurn({ contextWindow: 600 });
    const contractTemplate = templates["contract.roleplay"];
    const expectedContract = renderTemplate(contractTemplate?.content ?? "", {
      roleName: role.name,
    });
    const byKey = new Map(result.snapshot.blocks.map((block) => [block.key, block.text]));
    expect(byKey.get("contract")).toBe(expectedContract);
    expect(result.snapshot.budget.overBudgetAction).toBeDefined();
  });

  test("pinned beats older than the window are always included", () => {
    const result = compileTurn({
      scene: { ...scene, contextBeatsK: 2 },
      contextBeats: beats(8, 2),
    });
    const joined = result.messages.map((message) => message.content).join("\n");
    expect(joined).toContain("Pinned canon");
    expect(joined).toContain("Beat number 2");
    expect(joined).toContain("Beat number 8");
    expect(joined).not.toContain("Beat number 4");
  });

  test("own lines are assistant messages; others are user messages", () => {
    const result = compileTurn({ scene: { ...scene, contextBeatsK: 4 }, contextBeats: beats(8, 4) });
    const lastBeat = result.messages[result.messages.length - 1];
    expect(lastBeat?.role).toBe("user"); // beat 8 speaker is Mr. Đức
    expect(result.messages.some((message) => message.role === "assistant")).toBe(true);
  });
});
