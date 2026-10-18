import { describe, expect, test } from "vitest";
import { compileCastingPrompt, compileCastRegenPrompt, compileFieldRegenPrompt } from "../../convex/compiler/compileCasting";
import { compileContinuityPrompt, compileFactsPrompt, compileSummaryPrompt } from "../../convex/compiler/compileMemory";
import { compileDirectorPrompt } from "../../convex/compiler/compileDirectorMeta";
import { beats, model, templateMap } from "./fixtures";

const templates = templateMap();
const base = { templates, model, contextWindow: 128_000, outputReserve: 800 };

describe("memory prompts", () => {
  test("summary embeds the window and marks the mode", () => {
    const result = compileSummaryPrompt({ ...base, window: beats(3), fromSeq: 1, throughSeq: 3 });
    expect(result.system).toContain("MODE: summary");
    expect(result.messages[0]?.content).toContain("Linh:");
    expect(result.snapshot.mode).toBe("summary");
  });

  test("facts renders beat ids for nodeId grounding and existing ledger", () => {
    const result = compileFactsPrompt({
      ...base,
      window: beats(2),
      fromSeq: 1,
      existingFacts: ["The ledger is real."],
      max: 5,
    });
    expect(result.system).toContain("beat beat_1 (seq 1");
    expect(result.system).toContain("The ledger is real.");
    expect(result.snapshot.mode).toBe("facts");
  });

  test("continuity prompt carries recent beats and ledger", () => {
    const result = compileContinuityPrompt({
      ...base,
      recentBeats: beats(2),
      facts: ["The window is open."],
    });
    expect(result.system).toContain("MODE: continuity");
    expect(result.snapshot.mode).toBe("continuity");
  });
});

describe("casting prompts", () => {
  test("casting embeds premise, cast size and vibe steer", () => {
    const result = compileCastingPrompt({
      ...base,
      premise: "A debt collector knocks on the wrong door.",
      genre: "noir",
      settingEra: "Saigon, 1975",
      castSize: 4,
      vibeSteer: "make the whole cast younger",
      humanRoleNote: "",
    });
    expect(result.system).toContain("Cast size: 4 AI roles");
    expect(result.system).toContain("make the whole cast younger");
    expect(result.snapshot.mode).toBe("casting");
  });

  test("castRegen embeds locks and cast size", () => {
    const result = compileCastRegenPrompt({
      ...base,
      castSize: 3,
      locks: ["hook", "voice"],
      vibe: "darker",
      castSummary: "Linh, protagonist",
      scene: "rain, wrong door",
    });
    expect(result.system).toContain("Cast size: 3 roles");
    expect(result.system).toContain("hook, voice");
    expect(result.snapshot.mode).toBe("castRegen");
  });

  test("fieldRegen lists requested fields and excludes locked ones from the ask", () => {
    const result = compileFieldRegenPrompt({
      ...base,
      fields: ["psychology"],
      locks: ["hook"],
      roleJson: '{"hook":"locked hook"}',
      scene: "rain",
    });
    expect(result.system).toContain("regenerate only these role-card fields: psychology");
    expect(result.snapshot.mode).toBe("fieldRegen");
  });
});

describe("director meta prompt", () => {
  test("renders roles, cadence and turn mode for floor decisions", () => {
    const result = compileDirectorPrompt({
      ...base,
      lastBeat: "Linh: The rain keeps falling.",
      rolesLines: "role_linh: Linh (spotlight, protagonist)\nrole_duc: Mr. Đức (supporting, foil)",
      tensionsLine: "role_duc: 0.70 toward Linh",
      turnMode: "reactive",
      branchFrequency: "key",
    });
    expect(result.system).toContain("MODE: directorMeta");
    expect(result.system).toContain("Branch cadence: key");
    expect(result.system).toContain("role_linh: Linh (spotlight, protagonist)");
    expect(result.snapshot.mode).toBe("directorMeta");
  });
});
