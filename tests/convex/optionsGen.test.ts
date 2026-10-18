// @vitest-environment edge-runtime
import { expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { asUser, defaultSettings, makeCard, makeT, makeUser, seedScene } from "./helpers";

/**
 * Path options: cadence-driven offers, validation,
 * repair-then-fallback, and atomic candidate+snapshot persistence.
 */

test("cadence 'always' offers options right after a turn", async () => {
  const t = makeT();
  const owner = await makeUser(t);
  const { sceneId, client } = await seedScene(t, owner);
  await client.mutation(api.scenes.updateSettings, {
    sceneId,
    patch: { branchFrequency: "always" },
  });
  for (const name of ["Linh", "Duc", "Widow"]) {
    await client.mutation(api.cast.upsertDraftRole, {
      sceneId,
      kind: "ai",
      card: makeCard(name),
    });
  }
  await client.mutation(api.beats.appendOpening, { sceneId, text: "Rain." });

  const turn = await client.action(api.generation.turn.start, { sceneId });
  expect(turn.status).toBe("done");
  if (!turn.beatId) throw new Error("expected a beat");

  const candidates = await client.query(api.candidates.listForBeat, { beatId: turn.beatId });
  expect(candidates).toHaveLength(3);
  expect(candidates?.every((candidate) => candidate.status === "offered")).toBe(true);
  const strategies = new Set(candidates?.map((candidate) => candidate.strategy));
  expect(strategies.size).toBeGreaterThanOrEqual(2);

  // Candidates link their prompt snapshot (provenance per decision point).
  const optionSnapshots = await t.run(async (ctx) =>
    await ctx.db
      .query("promptSnapshots")
      .withIndex("by_scene_createdAt", (q) => q.eq("sceneId", sceneId))
      .collect(),
  );
  expect(optionSnapshots.some((row) => row.mode === "options")).toBe(true);
});

test("invalid model options trigger repair, then the deterministic fallback", async () => {
  const t = makeT();
  const owner = await makeUser(t);
  const client = asUser(t, owner);
  await client.mutation(api.prompts.seed.seedV1, {});
  const created = await client.mutation(api.scenes.create, {
    title: "Bad options",
    premise: "A knock on the wrong door.",
    settings: defaultSettings(),
  });
  for (const name of ["Linh", "Duc"]) {
    await client.mutation(api.cast.upsertDraftRole, {
      sceneId: created.sceneId,
      kind: "ai",
      card: makeCard(name),
    });
  }
  const opener = await client.mutation(api.beats.appendOpening, {
    sceneId: created.sceneId,
    text: "Rain. [[fake:options-bad]]",
  });

  const result = await client.action(api.generation.options.offer, {
    sceneId: created.sceneId,
    parentBeatId: opener.beatId,
  });
  expect(result.fallback).toBe(true);
  expect(result.warnings.length).toBeGreaterThanOrEqual(1);
  expect(result.candidateIds).toHaveLength(3); // deterministic fallback still fills the UI

  const candidates = await client.query(api.candidates.listForBeat, {
    beatId: opener.beatId,
  });
  const stateChanging = candidates?.some((candidate) =>
    ["escalate", "reveal", "confront", "commit"].includes(candidate.strategy),
  );
  expect(stateChanging).toBe(true);
});

test("on-demand offer produces valid candidates without markers", async () => {
  const t = makeT();
  const owner = await makeUser(t);
  const { sceneId, client } = await seedScene(t, owner);
  for (const name of ["Linh", "Duc"]) {
    await client.mutation(api.cast.upsertDraftRole, {
      sceneId,
      kind: "ai",
      card: makeCard(name),
    });
  }
  const opener = await client.mutation(api.beats.appendOpening, { sceneId, text: "Rain." });

  const result = await client.action(api.generation.options.offer, {
    sceneId,
    parentBeatId: opener.beatId,
  });
  expect(result.fallback).toBe(false);
  expect(result.warnings).toEqual([]);
  const candidates = await client.query(api.candidates.listForBeat, { beatId: opener.beatId });
  expect(candidates).toHaveLength(3);
  const roleRows = await t.run(async (ctx) =>
    await ctx.db
      .query("roles")
      .withIndex("by_scene", (q) => q.eq("sceneId", sceneId))
      .collect(),
  );
  const activeIds = new Set(roleRows.map((role) => role._id as string));
  expect(
    candidates?.every((candidate) => activeIds.has(candidate.speakerRoleId as string)),
  ).toBe(true);
});

test("non-owners cannot trigger options", async () => {
  const t = makeT();
  const owner = await makeUser(t, "Owner");
  const intruder = await makeUser(t, "Intruder");
  const { sceneId, client } = await seedScene(t, owner);
  const opener = await client.mutation(api.beats.appendOpening, { sceneId, text: "Rain." });
  await expect(
    asUser(t, intruder).action(api.generation.options.offer, {
      sceneId,
      parentBeatId: opener.beatId,
    }),
  ).rejects.toThrow(/access/i);
});
