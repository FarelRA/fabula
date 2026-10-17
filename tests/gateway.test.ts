import { describe, expect, test } from "vitest";
import { FakeGateway, modeMarker } from "../convex/lib/fakeGateway";
import { PathOptionsSchema } from "../convex/shared/contracts";
import { makeOption } from "./factories";

describe("FakeGateway", () => {
  test("streams scripted chunks in order for the MODE marker", async () => {
    const gateway = new FakeGateway();
    const deltas: string[] = [];
    for await (const delta of gateway.stream({
      model: "openai/gpt-4.1",
      system: "whatever\nMODE: turn\nrest",
      messages: [],
    })) {
      deltas.push(delta);
    }
    expect(deltas.join("")).toBe("The rain keeps falling.");
  });

  test("throws for an unscripted mode", async () => {
    const gateway = new FakeGateway({ streamChunks: { turn: ["ok"] } });
    const iterate = async () => {
      for await (const delta of gateway.stream({
        model: "m",
        system: "MODE: casting",
        messages: [],
      })) {
        void delta;
      }
    };
    await expect(iterate()).rejects.toThrow(/no stream script for mode "casting"/);
  });

  test("validates structured objects against the caller schema", async () => {
    const valid = {
      options: [
        makeOption(),
        makeOption({ label: "Wait outside", strategy: "deflect" }),
      ],
    };
    const gateway = new FakeGateway({ objects: { options: valid } });
    const parsed = await gateway.object({
      model: "m",
      system: "MODE: options",
      messages: [],
      schema: PathOptionsSchema,
      schemaName: "options",
    });
    expect(parsed.options).toHaveLength(2);
  });

  test("rejects invalid scripted objects like a real provider would be validated", async () => {
    const gateway = new FakeGateway({ objects: { options: { options: [makeOption()] } } });
    await expect(
      gateway.object({
        model: "m",
        system: "MODE: options",
        messages: [],
        schema: PathOptionsSchema,
        schemaName: "options",
      }),
    ).rejects.toThrow();
  });

  test("throws when no object is scripted", async () => {
    const gateway = new FakeGateway({ objects: {} });
    await expect(
      gateway.object({
        model: "m",
        system: "MODE: options",
        messages: [],
        schema: PathOptionsSchema,
        schemaName: "options",
      }),
    ).rejects.toThrow(/no object script for "options"/);
  });

  test("modeMarker defaults to turn", () => {
    expect(modeMarker({ model: "m", system: "no marker here", messages: [] })).toBe("turn");
  });
});
