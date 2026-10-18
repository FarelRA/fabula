import { describe, expect, test } from "vitest";
import {
  burstLabel,
  isNearBottom,
  nextSpeakerPreview,
  optionsForBeat,
  originLabel,
  roleById,
  shouldAutoStart,
  strategyLabel,
  tipOptions,
  trailingAiBeats,
} from "@/lib/play/helpers";
import type { PlayRun } from "@/lib/play/types";
import { makeBeat, makeOption, makeScene } from "./fixtures";

const NO_RUN: PlayRun | null = null;

describe("auto-burst gate (PLAN §8.2)", () => {
  test("starts after the opener and after director actions", () => {
    const scene = makeScene();
    expect(trailingAiBeats(scene.beats)).toBe(0);
    expect(
      shouldAutoStart({ scene, run: NO_RUN, hasTipOptions: false, pending: [] }),
    ).toBe(true);

    const afterPick = makeScene({
      beats: [
        ...scene.beats,
        makeBeat({ id: "picked", seq: 2, origin: "option" }),
      ],
    });
    expect(trailingAiBeats(afterPick.beats)).toBe(0);
    expect(
      shouldAutoStart({ scene: afterPick, run: NO_RUN, hasTipOptions: false, pending: [] }),
    ).toBe(true);
  });

  test("counts consecutive model turns and stops at burstMax", () => {
    const oneTurn = makeScene({
      beats: [
        ...makeScene().beats,
        makeBeat({ id: "beat_2", seq: 2, origin: "turn" }),
      ],
    });
    expect(trailingAiBeats(oneTurn.beats)).toBe(1);
    expect(burstLabel(oneTurn.beats, 2)).toBe("1/2");
    expect(
      shouldAutoStart({ scene: oneTurn, run: NO_RUN, hasTipOptions: false, pending: [] }),
    ).toBe(true);

    const twoTurns = makeScene({
      beats: [
        ...oneTurn.beats,
        makeBeat({ id: "beat_3", seq: 3, origin: "turn" }),
      ],
    });
    expect(trailingAiBeats(twoTurns.beats)).toBe(2);
    expect(burstLabel(twoTurns.beats, 2)).toBe("2/2");
    expect(
      shouldAutoStart({ scene: twoTurns, run: NO_RUN, hasTipOptions: false, pending: [] }),
    ).toBe(false);
  });

  test("paused, options, failures and runs all block the chain", () => {
    const scene = makeScene();
    expect(
      shouldAutoStart({
        scene: { ...scene, status: "paused" },
        run: NO_RUN,
        hasTipOptions: false,
        pending: [],
      }),
    ).toBe(false);
    expect(
      shouldAutoStart({ scene, run: NO_RUN, hasTipOptions: true, pending: [] }),
    ).toBe(false);
    expect(
      shouldAutoStart({
        scene,
        run: NO_RUN,
        hasTipOptions: false,
        pending: [makeBeat({ id: "failed", seq: 2, status: "failed" })],
      }),
    ).toBe(false);
    expect(
      shouldAutoStart({
        scene,
        run: {
          id: "run",
          mode: "turn",
          startedAt: 1,
          abortRequested: false,
        },
        hasTipOptions: false,
        pending: [],
      }),
    ).toBe(false);
    expect(
      shouldAutoStart({
        scene: {
          ...scene,
          settings: {
            ...scene.settings,
            turnRules: { ...scene.settings.turnRules, autoBurst: false },
          },
        },
        run: NO_RUN,
        hasTipOptions: false,
        pending: [],
      }),
    ).toBe(false);
  });
});

describe("floor preview + options grouping", () => {
  test("reactive fallback avoids the last speaker", () => {
    const scene = makeScene();
    const first = scene.roles[0]!;
    const second = scene.roles[1]!;
    const withTurn = makeScene({
      beats: [
        ...scene.beats,
        makeBeat({
          id: "beat_2",
          seq: 2,
          origin: "turn",
          speakerRoleId: first.id,
          text: "Rain, again.",
        }),
      ],
    });
    const next = nextSpeakerPreview(withTurn);
    expect(next?.id).not.toBe(first.id);
    expect([first.id, second.id, scene.roles[2]?.id]).toContain(next?.id);
  });

  test("an addressed role jumps the fallback queue", () => {
    const scene = makeScene();
    const target = scene.roles[2]!;
    const withTurn = makeScene({
      beats: [
        ...scene.beats,
        makeBeat({
          id: "beat_2",
          seq: 2,
          origin: "turn",
          speakerRoleId: scene.roles[0]!.id,
          text: `She turns to ${target.card.identity.name}.`,
        }),
      ],
    });
    expect(nextSpeakerPreview(withTurn)?.id).toBe(target.id);
  });

  test("options are grouped by parent and tip options sorted", () => {
    const options = [
      makeOption({ id: "b", optionIndex: 2, parentBeatId: "beat_1" }),
      makeOption({ id: "a", optionIndex: 1, parentBeatId: "beat_1" }),
      makeOption({ id: "ghost", parentBeatId: "beat_0", parentIsTip: false, parentSeq: 0 }),
    ];
    expect(optionsForBeat(options, "beat_1").map((option) => option.id)).toEqual([
      "a",
      "b",
    ]);
    expect(tipOptions(options).map((option) => option.id)).toEqual(["a", "b"]);
  });

  test("origin and strategy labels are honest", () => {
    expect(
      originLabel(makeBeat({ id: "b", seq: 1, origin: "opening" })),
    ).toBe("Opening");
    expect(
      originLabel(makeBeat({ id: "b", seq: 1, origin: "userInsert" })),
    ).toBe("You wrote");
    expect(originLabel(makeBeat({ id: "b", seq: 1, origin: "turn" }))).toBeNull();
    expect(strategyLabel("de-escalate")).toBe("De-escalate");
    expect(strategyLabel("mystery")).toBe("mystery");
    expect(roleById(makeScene().roles, "missing")).toBeUndefined();
  });
});

describe("scroll intent", () => {
  test("near-bottom allows a 96px slack", () => {
    expect(
      isNearBottom({ scrollTop: 720, scrollHeight: 1400, clientHeight: 600 }),
    ).toBe(true);
    expect(
      isNearBottom({ scrollTop: 650, scrollHeight: 1400, clientHeight: 600 }),
    ).toBe(false);
    expect(
      isNearBottom({
        scrollTop: 720,
        scrollHeight: 1400,
        clientHeight: 600,
        threshold: 60,
      }),
    ).toBe(false);
  });
});
