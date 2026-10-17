import { describe, expect, test } from "vitest";
import {
  detectStall,
  resolveFloor,
  shouldAutoBurst,
  type OrchestrationRole,
} from "../../convex/domain/orchestrate";

const roles: OrchestrationRole[] = [
  { id: "r1", name: "Linh", tier: "spotlight", status: "active" },
  { id: "r2", name: "Duc", tier: "spotlight", status: "active" },
  { id: "r3", name: "Widow", tier: "background", status: "active" },
];

describe("resolveFloor", () => {
  test("forced mention overrides everything, including the queue", () => {
    const decision = resolveFloor({
      mode: "directorLed",
      roles,
      forcedRoleId: "r2",
      queue: ["r3"],
    });
    expect(decision.speakerRoleId).toBe("r2");
    expect(decision.reason).toBe("forced mention");
  });

  test("queue pops before turn mode", () => {
    const decision = resolveFloor({ mode: "roundRobin", roles, queue: ["r3"] });
    expect(decision.speakerRoleId).toBe("r3");
    expect(decision.reason).toBe("director queue");
  });

  test("reactive: an addressed role responds", () => {
    const decision = resolveFloor({
      mode: "reactive",
      roles,
      lastBeat: { text: "Duc, tell me where he went.", speakerRoleId: "r1" },
    });
    expect(decision.speakerRoleId).toBe("r2");
    expect(decision.reason).toContain("reactive");
  });

  test("reactive: background roles never enter via tension", () => {
    const decision = resolveFloor({
      mode: "reactive",
      roles,
      lastBeat: { text: "The rain keeps falling.", speakerRoleId: "r1" },
      tensions: { r3: 0.95 },
    });
    expect(decision.responders).not.toContain("r3");
    expect(decision.speakerRoleId).toBe("r2"); // spotlight rotation fallback
  });

  test("reactive: background roles DO respond when addressed", () => {
    const decision = resolveFloor({
      mode: "reactive",
      roles,
      lastBeat: { text: "Widow, you knew him.", speakerRoleId: "r1" },
    });
    expect(decision.speakerRoleId).toBe("r3");
  });

  test("reactive: never talks to itself when others exist", () => {
    const decision = resolveFloor({
      mode: "reactive",
      roles,
      lastBeat: { text: "Linh, Linh.", speakerRoleId: "r1" },
    });
    expect(decision.speakerRoleId).not.toBe("r1");
  });

  test("round robin cycles seat order", () => {
    expect(
      resolveFloor({ mode: "roundRobin", roles, lastBeat: { text: "", speakerRoleId: "r1" } })
        .speakerRoleId,
    ).toBe("r2");
    expect(
      resolveFloor({ mode: "roundRobin", roles, lastBeat: { text: "", speakerRoleId: "r3" } })
        .speakerRoleId,
    ).toBe("r1");
  });

  test("director-led and freeform skip without a cue", () => {
    expect(resolveFloor({ mode: "directorLed", roles }).skip).toBe(true);
    expect(resolveFloor({ mode: "freeform", roles }).skip).toBe(true);
  });

  test("skips when there are no active roles", () => {
    const retired: OrchestrationRole[] = [
      { id: "r1", name: "Linh", tier: "spotlight", status: "retired" },
    ];
    expect(resolveFloor({ mode: "reactive", roles: retired }).skip).toBe(true);
  });

  test("a background-only cast cannot rotate on its own", () => {
    const backgroundOnly: OrchestrationRole[] = [
      { id: "r1", name: "Crowd", tier: "background", status: "active" },
    ];
    const decision = resolveFloor({
      mode: "reactive",
      roles: backgroundOnly,
      lastBeat: { text: "Nothing happened.", speakerRoleId: "r1" },
    });
    expect(decision.skip).toBe(true);
  });
});

describe("shouldAutoBurst", () => {
  test("bursts until the cap", () => {
    expect(
      shouldAutoBurst({ autoBurst: true, burstMax: 2, consecutiveAiBeats: 0, decisionPoint: false, userDirected: false }),
    ).toBe(true);
    expect(
      shouldAutoBurst({ autoBurst: true, burstMax: 2, consecutiveAiBeats: 2, decisionPoint: false, userDirected: false }),
    ).toBe(false);
  });

  test("never bursts past a decision point", () => {
    expect(
      shouldAutoBurst({ autoBurst: true, burstMax: 3, consecutiveAiBeats: 0, decisionPoint: true, userDirected: false }),
    ).toBe(false);
  });

  test("never bursts after user direction or when disabled", () => {
    expect(
      shouldAutoBurst({ autoBurst: true, burstMax: 3, consecutiveAiBeats: 0, decisionPoint: false, userDirected: true }),
    ).toBe(false);
    expect(
      shouldAutoBurst({ autoBurst: false, burstMax: 3, consecutiveAiBeats: 0, decisionPoint: false, userDirected: false }),
    ).toBe(false);
  });
});

describe("detectStall", () => {
  test("three consecutive no-change beats stall", () => {
    expect(detectStall({ beatsSinceStateChange: [true, false, false, false] })).toBe(true);
  });

  test("a recent state change clears the stall", () => {
    expect(detectStall({ beatsSinceStateChange: [false, false, true] })).toBe(false);
  });

  test("fewer than three beats is never a stall", () => {
    expect(detectStall({ beatsSinceStateChange: [false, false] })).toBe(false);
  });
});
