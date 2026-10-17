import { describe, expect, test } from "vitest";
import { DEFAULT_FAKE_SCRIPT, FakeGateway, modeMarker } from "../convex/lib/fakeGateway";
import type { GenerationRequest, ModelGateway } from "../convex/lib/gateway";
import { PathOptionsSchema } from "../convex/shared/contracts";
import { makeOption } from "./factories";

const requestBase: GenerationRequest = {
  model: "openai/gpt-4.1",
  system: "",
  messages: [],
};

describe("FakeGateway", () => {
  test("streams scripted chunks in order for the MODE marker", async () => {
    const gateway = new FakeGateway();
    const deltas: string[] = [];
    for await (const delta of gateway.stream({
      ...requestBase,
      system: "whatever\nMODE: turn\nrest",
    })) {
      deltas.push(delta);
    }
    expect(deltas.join("")).toBe("The rain keeps falling.");
  });

  test("throws for an unscripted streaming mode", async () => {
    const gateway = new FakeGateway();
    const iterate = async () => {
      for await (const delta of gateway.stream({
        ...requestBase,
        system: "MODE: casting",
      })) {
        void delta;
      }
    };
    await expect(iterate()).rejects.toThrow(/no stream script for mode "casting"/);
  });

  test("validates explicitly scripted objects against the caller schema", async () => {
    const valid = {
      options: [makeOption(), makeOption({ label: "Wait outside", strategy: "deflect" })],
    };
    const gateway = new FakeGateway({ objects: { options: valid } });
    const parsed = await gateway.object({
      ...requestBase,
      system: "MODE: options",
      schema: PathOptionsSchema,
      schemaName: "options",
    });
    expect(parsed.options).toHaveLength(2);
  });

  test("rejects invalid scripted objects exactly like a real provider response", async () => {
    const gateway = new FakeGateway({ objects: { options: { options: [makeOption()] } } });
    await expect(
      gateway.object({
        ...requestBase,
        system: "MODE: options",
        schema: PathOptionsSchema,
        schemaName: "options",
      }),
    ).rejects.toThrow();
  });

  test("synthesizes valid options by default (no scripting needed)", async () => {
    const gateway = new FakeGateway();
    const parsed = await gateway.object({
      ...requestBase,
      system: "MODE: options\nTask: propose 3 candidate continuations.\nspeakerRoleId must be one of: role_a, role_b",
      schema: PathOptionsSchema,
      schemaName: "options",
    });
    expect(parsed.options).toHaveLength(3);
    expect(parsed.options.map((option) => option.speakerRoleId)).toEqual([
      "role_a",
      "role_b",
      "role_a",
    ]);
    expect(parsed.options.some((option) => option.strategy === "escalate")).toBe(true);
  });

  test("honors the bad-options marker for repair-path tests", async () => {
    const gateway = new FakeGateway();
    await expect(
      gateway.object({
        ...requestBase,
        system: "MODE: options\n[[fake:options-bad]]\nspeakerRoleId must be one of: role_a",
        schema: PathOptionsSchema,
        schemaName: "options",
      }),
    ).rejects.toThrow();
  });

  test("nothing is synthesized when synthesize is disabled and no script exists", async () => {
    const gateway = new FakeGateway({ synthesize: false, objects: {} });
    await expect(
      gateway.object({
        ...requestBase,
        system: "MODE: options",
        schema: PathOptionsSchema,
        schemaName: "options",
      }),
    ).rejects.toThrow(/no object script for "options"/);
  });

  test("modeMarker defaults to turn and the default script is intact", () => {
    expect(modeMarker({ ...requestBase, system: "no marker here" })).toBe("turn");
    expect(DEFAULT_FAKE_SCRIPT.streamChunks?.turn?.join("")).toBe("The rain keeps falling.");
  });

  test("contextWindow is configurable and deterministic", () => {
    const standard: ModelGateway = new FakeGateway();
    expect(standard.contextWindow("openai/gpt-4.1")).toBe(128_000);
    const tiny: ModelGateway = new FakeGateway({ contextWindow: 4096 });
    expect(tiny.contextWindow("x/y")).toBe(4096);
  });
});
