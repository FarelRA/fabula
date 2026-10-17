// @vitest-environment edge-runtime
import { expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { makeCard, makeT, makeUser, seedScene } from "./helpers";

/**
 * Memory agent (PLAN Phase 2.6): summary cadence, fact extraction with
 * dedupe, continuity warnings, snapshot provenance for each product.
 */

test("memory pass: summary at the cadence, facts extracted and deduped", async () => {
  const t = makeT();
  const owner = await makeUser(t);
  const { sceneId, client } = await seedScene(t, owner);
  await client.mutation(api.scenes.updateSettings, {
    sceneId,
    patch: { summaryEveryN: 2 },
  });
  await client.mutation(api.cast.upsertDraftRole, {
    sceneId,
    kind: "ai",
    card: makeCard("Linh"),
  });
  const opener = await client.mutation(api.beats.appendOpening, { sceneId, text: "Rain." });
  await client.mutation(api.beats.appendUserBeat, {
    sceneId,
    text: "She knocked twice.",
  });
  await client.mutation(api.beats.appendUserBeat, {
    sceneId,
    text: "The door opened a hand's width.",
  });

  // Below cadence → no-op.
  const early = await client.action(internal.generation.memory.runPass, { sceneId });
  expect(early.ran).toBe(true); // 3 beats since last summary ≥ 2

  const summaries = await client.query(api.summaries.listForPath, { sceneId });
  expect(summaries).toHaveLength(1);
  expect(summaries[0]?.text).toContain("knock happened");

  const facts = await client.query(api.facts.listForPath, { sceneId });
  expect(facts.length).toBe(2); // fake extracts from the last two window beats

  // Same window again → nothing new (summary covers it; facts dedupe).
  const again = await client.action(internal.generation.memory.runPass, { sceneId });
  expect(again.ran).toBe(false); // window empty

  // New beat, forced pass: summary advances; identical fake facts dedupe away.
  await client.mutation(api.beats.appendUserBeat, {
    sceneId,
    text: "Someone inside said her brother's name.",
  });
  const forced = await client.action(internal.generation.memory.runPass, {
    sceneId,
    force: true,
  });
  expect(forced.ran).toBe(true);
  expect(forced.factsAdded).toBe(0); // dedupe: same fake fact text
  const summariesAfter = await client.query(api.summaries.listForPath, { sceneId });
  expect(summariesAfter.length).toBe(2);
  expect(summariesAfter[0]?.coveredThroughSeq).toBeGreaterThanOrEqual(opener.seq);

  // Provenance: summary/facts/continuity snapshots all exist.
  const snapshots = await t.run(async (ctx) =>
    await ctx.db
      .query("promptSnapshots")
      .withIndex("by_scene_createdAt", (q) => q.eq("sceneId", sceneId))
      .collect(),
  );
  const modes = new Set(snapshots.map((row) => row.mode));
  expect(modes.has("summary")).toBe(true);
  expect(modes.has("facts")).toBe(true);
  expect(modes.has("continuity")).toBe(true);
});

test("memory pass is skipped when below the cadence", async () => {
  const t = makeT();
  const owner = await makeUser(t);
  const { sceneId, client } = await seedScene(t, owner); // summaryEveryN default 6
  await client.mutation(api.cast.upsertDraftRole, {
    sceneId,
    kind: "ai",
    card: makeCard("Linh"),
  });
  await client.mutation(api.beats.appendOpening, { sceneId, text: "Rain." });
  await client.mutation(api.beats.appendUserBeat, { sceneId, text: "One beat." });

  const result = await client.action(internal.generation.memory.runPass, { sceneId });
  expect(result.ran).toBe(false);
  expect(result.factsAdded).toBe(0);
  const summaries = await client.query(api.summaries.listForPath, { sceneId });
  expect(summaries).toHaveLength(0);
});
