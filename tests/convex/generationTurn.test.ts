// @vitest-environment edge-runtime
import { expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { asUser, defaultSettings, makeCard, makeT, makeUser, seedScene, type T } from "./helpers";

/**
 * Turn generation (PLAN Phase 2.3): streaming persistence via the agent
 * component, snapshot-first provenance, usage recording, and the failure /
 * abort state machine that guarantees the tree is never corrupted.
 */

const FAKE_TURN_TEXT = "The rain keeps falling on the wrong door.";

async function seedCastAndOpener(t: T, owner: string, names: string[]) {
  const { sceneId, branchId, client } = await seedScene(t, owner);
  const roleIds = [];
  for (const name of names) {
    roleIds.push(
      await client.mutation(api.cast.upsertDraftRole, {
        sceneId,
        kind: "ai",
        card: makeCard(name),
      }),
    );
  }
  const opener = await client.mutation(api.beats.appendOpening, {
    sceneId,
    text: "Rain hadn't stopped for three days when she knocked.",
  });
  return { sceneId, branchId, roleIds, openerBeatId: opener.beatId, client };
}

test("a turn streams, finalizes the beat, moves the tip, and persists provenance", async () => {
  const t = makeT();
  const owner = await makeUser(t);
  const { sceneId, openerBeatId, client } = await seedCastAndOpener(t, owner, ["Linh", "Duc"]);

  const turn = await client.action(api.generation.turn.start, { sceneId });
  expect(turn.status).toBe("done");
  expect(turn.beatId).toBeDefined();
  if (!turn.beatId) throw new Error("expected a beat");

  // Beat finalized with the streamed text; tip moved.
  const beat = await client.query(api.beats.getWithOptions, { beatId: turn.beatId });
  expect(beat?.beat.status).toBe("finished");
  expect(beat?.beat.text).toBe(FAKE_TURN_TEXT);
  expect(beat?.beat.streamMessageId).toBeDefined(); // transport link (PLAN §2.4)
  const scene = await client.query(api.scenes.get, { sceneId });
  expect(scene.scene.activeTipBeatId).toBe(turn.beatId);
  expect(scene.scene.status).toBe("playing");
  const path = await client.query(api.beats.listPath, { sceneId });
  expect(path.beats.map((b) => b._id)).toEqual([openerBeatId, turn.beatId]);

  // Snapshot written for the beat (prompt inspector source of truth).
  const snapshots = await t.run(async (ctx) =>
    await ctx.db
      .query("promptSnapshots")
      .withIndex("by_scene_createdAt", (q) => q.eq("sceneId", sceneId))
      .collect(),
  );
  const turnSnapshots = snapshots.filter((row) => row.mode === "turn");
  expect(turnSnapshots.length).toBeGreaterThanOrEqual(1);
  const snapshot = turnSnapshots[0];
  expect(snapshot?.beatId).toBe(turn.beatId);
  expect(snapshot?.blocks).toHaveLength(8);
  for (const block of snapshot?.blocks ?? []) {
    expect(block.text.length).toBeGreaterThan(0);
    expect(block.hash.length).toBeGreaterThan(0);
  }

  // Usage recorded (fake usage: 3 in / 10 out).
  const usage = await client.query(api.usage.getSceneUsage, { sceneId });
  expect(usage.tokensIn).toBeGreaterThan(0);
  const events = await t.run(async (ctx) =>
    await ctx.db
      .query("usageEvents")
      .withIndex("by_scene_createdAt", (q) => q.eq("sceneId", sceneId))
      .collect(),
  );
  expect(events.some((event) => event.kind === "turn")).toBe(true);

  // Thread created on the scene (implementation detail, never surfaced).
  const sceneRow = await t.run(async (ctx) => await ctx.db.get(sceneId));
  expect(sceneRow?.threadId).toBeDefined();
});

test("failure before the first delta leaves NO beat row", async () => {
  const t = makeT();
  const owner = await makeUser(t);
  const client = asUser(t, owner);
  await client.mutation(api.prompts.seed.seedV1, {});
  const created = await client.mutation(api.scenes.create, {
    title: "Broken",
    premise: "A knock. [[fake:fail-before]]",
    settings: defaultSettings(),
  });
  await client.mutation(api.cast.upsertDraftRole, {
    sceneId: created.sceneId,
    kind: "ai",
    card: makeCard("Linh"),
  });
  await client.mutation(api.beats.appendOpening, {
    sceneId: created.sceneId,
    text: "Rain.",
  });

  const turn = await client.action(api.generation.turn.start, { sceneId: created.sceneId });
  expect(turn.status).toBe("failed");
  expect(turn.beatId).toBeUndefined();

  const path = await client.query(api.beats.listPath, { sceneId: created.sceneId });
  expect(path.beats).toHaveLength(1); // opener only — tree intact

  const runs = await t.run(async (ctx) =>
    await ctx.db
      .query("generationRuns")
      .withIndex("by_scene_status", (q) => q.eq("sceneId", created.sceneId))
      .collect(),
  );
  expect(runs.every((run) => run.status !== "running")).toBe(true);

  // The failure still produced a snapshot (provenance for debugging).
  const snapshots = await t.run(async (ctx) =>
    await ctx.db
      .query("promptSnapshots")
      .withIndex("by_scene_createdAt", (q) => q.eq("sceneId", created.sceneId))
      .collect(),
  );
  expect(snapshots.filter((row) => row.mode === "turn").length).toBeGreaterThanOrEqual(1);
});

test("mid-stream failure marks the beat failed without moving the tip", async () => {
  const t = makeT();
  const owner = await makeUser(t);
  const client = asUser(t, owner);
  await client.mutation(api.prompts.seed.seedV1, {});
  const created = await client.mutation(api.scenes.create, {
    title: "Broken mid",
    premise: "A knock. [[fake:fail-mid:2]] [[fake:chunks:Alpha|beta|gamma|delta]]",
    settings: defaultSettings(),
  });
  await client.mutation(api.cast.upsertDraftRole, {
    sceneId: created.sceneId,
    kind: "ai",
    card: makeCard("Linh"),
  });
  const opener = await client.mutation(api.beats.appendOpening, {
    sceneId: created.sceneId,
    text: "Rain.",
  });

  const turn = await client.action(api.generation.turn.start, { sceneId: created.sceneId });
  expect(turn.status).toBe("failed");
  if (!turn.beatId) throw new Error("expected a partial beat");

  const beat = await client.query(api.beats.getWithOptions, { beatId: turn.beatId });
  expect(beat?.beat.status).toBe("failed");
  expect(beat?.beat.text.startsWith("Alpha")).toBe(true);
  const scene = await client.query(api.scenes.get, { sceneId: created.sceneId });
  expect(scene.scene.activeTipBeatId).toBe(opener.beatId); // tip unchanged
});

test("abort semantics: discarded partials become artifacts; kept partials canonize", async () => {
  const t = makeT();
  const owner = await makeUser(t);
  const { sceneId, branchId, roleIds, openerBeatId, client } = await seedCastAndOpener(t, owner, [
    "Linh",
  ]);
  const roleId = roleIds[0];
  if (!roleId) throw new Error("no role");

  const snapshotPayload = {
    mode: "turn" as const,
    blocks: [{ key: "mode", text: "Mode block", hash: "abc123", tokens: 3, chars: 11 }],
    model: { provider: "fake", modelId: "fake-model", params: {} },
    tokenCounts: { system: 3, context: 0, outputReserve: 0, total: 3 },
    budget: { contextWindow: 1000, systemTargetPct: 0.25 },
  };

  // (1) aborted + discard → artifact, tip untouched.
  const runA = await t.mutation(internal.generation.runs.begin, {
    sceneId,
    branchId,
    parentBeatId: openerBeatId,
    mode: "turn",
    roleId,
  });
  const beatA = await t.mutation(internal.generation.lifecycle.beginBeat, {
    sceneId,
    runId: runA,
    roleId,
    parentBeatId: openerBeatId,
    opening: false,
  });
  await t.mutation(internal.generation.lifecycle.completeRun, {
    sceneId,
    runId: runA,
    beatId: beatA.beatId,
    text: "half a thought",
    outcome: "aborted",
    keepPartial: false,
    opening: false,
    tokensIn: 3,
    tokensOut: 4,
    snapshot: snapshotPayload,
  });
  const discarded = await client.query(api.beats.getWithOptions, { beatId: beatA.beatId });
  expect(discarded?.beat.status).toBe("aborted");
  expect(discarded?.beat.isArtifact).toBe(true);
  const afterDiscard = await client.query(api.scenes.get, { sceneId });
  expect(afterDiscard.scene.activeTipBeatId).toBe(openerBeatId);
  expect((await client.query(api.beats.listPath, { sceneId })).beats).toHaveLength(1);

  // (2) aborted + keep → the partial becomes canon (finished + tip moved).
  const runB = await t.mutation(internal.generation.runs.begin, {
    sceneId,
    branchId,
    parentBeatId: openerBeatId,
    mode: "turn",
    roleId,
  });
  const beatB = await t.mutation(internal.generation.lifecycle.beginBeat, {
    sceneId,
    runId: runB,
    roleId,
    parentBeatId: openerBeatId,
    opening: false,
  });
  await t.mutation(internal.generation.lifecycle.completeRun, {
    sceneId,
    runId: runB,
    beatId: beatB.beatId,
    text: "a finished half-thought",
    outcome: "aborted",
    keepPartial: true,
    opening: false,
    tokensIn: 3,
    tokensOut: 5,
    snapshot: snapshotPayload,
  });
  const kept = await client.query(api.beats.getWithOptions, { beatId: beatB.beatId });
  expect(kept?.beat.status).toBe("finished");
  expect(kept?.beat.isArtifact).toBe(false);
  const afterKeep = await client.query(api.scenes.get, { sceneId });
  expect(afterKeep.scene.activeTipBeatId).toBe(beatB.beatId);
  const path = await client.query(api.beats.listPath, { sceneId });
  expect(path.beats.map((b) => b._id)).toEqual([openerBeatId, beatB.beatId]);
});
