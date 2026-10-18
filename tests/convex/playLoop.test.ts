// @vitest-environment edge-runtime
import { expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import {
  asUser,
  defaultSettings,
  makeCard,
  makeT,
  makeUser,
  seedScene,
  type T,
} from "./helpers";

/**
 * Phase 5 backend surface: pending stream rows, scene-wide offered options,
 * public floor state, regeneration forks, and the streaming transport query.
 */

const FAKE_TURN_TEXT = "The rain keeps falling on the wrong door.";

async function seedCastAndOpener(t: T, owner: string, names = ["Linh", "Duc"]) {
  const { sceneId, branchId, client } = await seedScene(t, owner);
  const roleIds: string[] = [];
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

test("pending beats surface in-flight/failed children without entering the path", async () => {
  const t = makeT();
  const owner = await makeUser(t);
  const client = asUser(t, owner);
  await client.mutation(api.prompts.seed.seedV1, {});
  const created = await client.mutation(api.scenes.create, {
    title: "Broken mid",
    premise:
      "A knock. [[fake:fail-mid:2]] [[fake:chunks:Alpha|beta|gamma|delta]]",
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

  const turn = await client.action(api.generation.turn.start, {
    sceneId: created.sceneId,
  });
  expect(turn.status).toBe("failed");
  if (!turn.beatId) throw new Error("expected partial beat");

  const pending = await client.query(api.beats.listPending, {
    sceneId: created.sceneId,
  });
  expect(pending).toHaveLength(1);
  expect(pending[0]?._id).toBe(turn.beatId);
  expect(pending[0]?.status).toBe("failed");
  expect(pending[0]?.text.startsWith("Alpha")).toBe(true);

  const path = await client.query(api.beats.listPath, {
    sceneId: created.sceneId,
  });
  expect(path.beats.map((beat) => beat._id)).toEqual([opener.beatId]);
  expect(await client.query(api.generation.runs.active, { sceneId: created.sceneId })).toBeNull();
});

test("offered options expose their parent beat and tip status", async () => {
  const t = makeT();
  const owner = await makeUser(t);
  const { sceneId, client } = await seedCastAndOpener(t, owner);

  const turn = await client.action(api.generation.turn.start, { sceneId });
  expect(turn.status).toBe("done");
  if (!turn.beatId) throw new Error("expected turn beat");

  const options = await client.query(api.candidates.listForScene, { sceneId });
  expect(options.length).toBeGreaterThanOrEqual(2);
  for (const option of options) {
    expect(option.status).toBe("offered");
    expect(option.parentBeatId).toBe(turn.beatId);
    expect(option.parentSeq).toBeGreaterThan(0);
    expect(option.parentIsTip).toBe(true);
  }
});

test("runs.active exposes the speaking role while a run is open", async () => {
  const t = makeT();
  const owner = await makeUser(t);
  const { sceneId, branchId, roleIds, openerBeatId, client } = await seedCastAndOpener(
    t,
    owner,
  );
  const roleId = roleIds[0];
  if (!roleId) throw new Error("no role");

  const runId = await t.mutation(internal.generation.runs.begin, {
    sceneId,
    branchId,
    parentBeatId: openerBeatId,
    mode: "turn",
    roleId: roleId as never,
  });
  const active = await client.query(api.generation.runs.active, { sceneId });
  expect(active?.roleId).toBe(roleId);
  expect(active?.roleName).toBe("Linh");
  expect(active?.mode).toBe("turn");

  await t.mutation(internal.generation.runs.fail, {
    runId,
    error: "test cleanup",
  });
  expect(await client.query(api.generation.runs.active, { sceneId })).toBeNull();
});

test("regenerate forks without touching the original and undo restores the tip", async () => {
  const t = makeT();
  const owner = await makeUser(t);
  const { sceneId, client } = await seedCastAndOpener(t, owner);

  const turn = await client.action(api.generation.turn.start, { sceneId });
  expect(turn.status).toBe("done");
  if (!turn.beatId) throw new Error("expected turn beat");

  // A note carrying a fake chunk script makes the rewritten text distinctive.
  await client.mutation(api.directorNotes.add, {
    sceneId,
    kind: "steer",
    text: "[[fake:chunks:Rewritten|opening|line]]",
  });

  const regen = await client.action(api.generation.regenerate.beat, {
    beatId: turn.beatId,
    instruction: "Pitch it darker.",
  });
  expect(regen.status).toBe("done");
  if (!regen.beatId) throw new Error("expected regenerated beat");
  expect(regen.beatId).not.toBe(turn.beatId);

  const original = await client.query(api.beats.getWithOptions, {
    beatId: turn.beatId,
  });
  expect(original?.beat.text).toBe(FAKE_TURN_TEXT); // never edited in place
  expect(original?.beat.status).toBe("finished");

  const rewritten = await client.query(api.beats.getWithOptions, {
    beatId: regen.beatId,
  });
  expect(rewritten?.beat.text).toBe("Rewritten opening line");
  expect(rewritten?.beat.origin).toBe("regenerate");
  expect(rewritten?.beat.regenerateOfBeatId).toBe(turn.beatId);

  const scene = await client.query(api.scenes.get, { sceneId });
  expect(scene.scene.activeTipBeatId).toBe(regen.beatId);
  expect(scene.scene.activeBranchId).toBe(regen.branchId);

  const branches = await t.run(async (ctx) =>
    await ctx.db
      .query("branches")
      .withIndex("by_scene", (q) => q.eq("sceneId", sceneId))
      .collect(),
  );
  expect(branches).toHaveLength(2);

  const path = await client.query(api.beats.listPath, { sceneId });
  expect(path.beats.map((beat) => beat._id)).toContain(regen.beatId);
  expect(path.beats.map((beat) => beat._id)).not.toContain(turn.beatId);

  // Undo restores the pre-fork active tip; both branches remain.
  await client.mutation(api.actions.undoLast, { sceneId });
  const undone = await client.query(api.scenes.get, { sceneId });
  expect(undone.scene.activeTipBeatId).toBe(turn.beatId);
  const rewrittenStillThere = await client.query(api.beats.getWithOptions, {
    beatId: regen.beatId,
  });
  expect(rewrittenStillThere?.beat.text).toBe("Rewritten opening line");
});

test("regenerating the opening forks the root and preserves the original", async () => {
  const t = makeT();
  const owner = await makeUser(t);
  const { sceneId, openerBeatId, client } = await seedCastAndOpener(t, owner);
  await client.mutation(api.directorNotes.add, {
    sceneId,
    kind: "steer",
    text: "[[fake:chunks:A|different|first|line]]",
  });

  const regen = await client.action(api.generation.regenerate.beat, {
    beatId: openerBeatId,
  });
  expect(regen.status).toBe("done");
  if (!regen.beatId) throw new Error("expected regenerated opener");

  const original = await client.query(api.beats.getWithOptions, {
    beatId: openerBeatId,
  });
  expect(original?.beat.text).toBe("Rain hadn't stopped for three days when she knocked.");
  const path = await client.query(api.beats.listPath, { sceneId });
  expect(path.beats.map((beat) => beat._id)).toEqual([regen.beatId]);
  const scene = await client.query(api.scenes.get, { sceneId });
  expect(scene.scene.activeTipBeatId).toBe(regen.beatId);
});

test("outsiders cannot regenerate a scene they do not own", async () => {
  const t = makeT();
  const owner = await makeUser(t, "Owner");
  const outsider = await makeUser(t, "Outsider");
  const { sceneId, client, openerBeatId } = await seedCastAndOpener(t, owner);
  const turn = await client.action(api.generation.turn.start, { sceneId });
  if (!turn.beatId) throw new Error("expected beat");

  const intruder = asUser(t, outsider);
  await expect(
    intruder.action(api.generation.regenerate.beat, { beatId: turn.beatId }),
  ).rejects.toThrow(/access|owner|not found|authenticated/i);
  expect(openerBeatId).toBeTruthy();
});

test("thread.stream read returns the persisted turn message", async () => {
  const t = makeT();
  const owner = await makeUser(t);
  const { sceneId, client } = await seedCastAndOpener(t, owner);

  const before = await t.run(async (ctx) => await ctx.db.get(sceneId));
  expect(before?.threadId).toBeUndefined();

  const empty = await client.query(api.thread.listMessages, {
    sceneId,
    threadId: "missing",
    paginationOpts: { numItems: 10, cursor: null },
    streamArgs: { kind: "list" },
  });
  expect(empty.page).toHaveLength(0);

  const turn = await client.action(api.generation.turn.start, { sceneId });
  expect(turn.status).toBe("done");
  if (!turn.beatId) throw new Error("expected turn beat");
  const row = await t.run(async (ctx) => await ctx.db.get(sceneId));
  const threadId = row?.threadId;
  if (!threadId) throw new Error("thread not created");

  const page = await client.query(api.thread.listMessages, {
    sceneId,
    threadId,
    paginationOpts: { numItems: 20, cursor: null },
    streamArgs: { kind: "list" },
  });
  expect(page.page.length).toBeGreaterThan(0);
  const assistant = page.page.find((message) => message.role === "assistant");
  expect(assistant?.text).toContain("rain keeps falling");
});

test("option feed and pending query are access-controlled", async () => {
  const t = makeT();
  const owner = await makeUser(t, "Owner");
  const outsider = await makeUser(t, "Outsider");
  const { sceneId } = await seedCastAndOpener(t, owner);

  const intruder = asUser(t, outsider);
  await expect(
    intruder.query(api.candidates.listForScene, { sceneId }),
  ).rejects.toThrow(/access|owner|not found/i);
  await expect(
    intruder.query(api.beats.listPending, { sceneId }),
  ).rejects.toThrow(/access|owner|not found/i);
});
