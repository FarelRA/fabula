// @vitest-environment edge-runtime
import { expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { makeCard, makeT, makeUser, seedPlayableScene } from "./helpers";

/**
 * Undo + reversibility (law L6, PLAN §8.4): every reversible director action
 * can be undone; the story tree is never destroyed, only pointers move.
 */

test("undoing a pick restores pointers and the candidate, keeping the beat", async () => {
  const t = makeT();
  const owner = await makeUser(t);
  const { sceneId, client, openerBeatId } = await seedPlayableScene(t, owner);

  await client.mutation(api.candidates.createBatch, {
    sceneId,
    parentBeatId: openerBeatId,
    options: [{ label: "Push inside", text: "She pushes the door.", strategy: "escalate" }],
  });
  const options = await client.query(api.candidates.listForBeat, { beatId: openerBeatId });
  const first = options?.[0];
  if (!first) throw new Error("expected an option");
  const picked = await client.mutation(api.candidates.pick, { candidateId: first._id });

  const undone = await client.mutation(api.actions.undoLast, { sceneId });
  expect(undone.undone).toBe(true);
  expect(undone.type).toBe("candidate.pick");

  const scene = await client.query(api.scenes.get, { sceneId });
  expect(scene.scene.activeTipBeatId).toBe(openerBeatId);

  const candidates = await client.query(api.candidates.listForBeat, { beatId: openerBeatId });
  expect(candidates?.find((c) => c._id === first._id)?.status).toBe("offered");

  // The picked beat still EXISTS (nothing destroyed) but is off the active path.
  const beat = await client.query(api.beats.getWithOptions, { beatId: picked.beatId });
  expect(beat?.beat.text).toBe("She pushes the door.");
  const path = await client.query(api.beats.listPath, { sceneId });
  expect(path.beats.map((b) => b._id)).toEqual([openerBeatId]);

  // A second undo has nothing left to unwind.
  const again = await client.mutation(api.actions.undoLast, { sceneId });
  expect(again.undone).toBe(false);
});

test("undoing an editFork returns to the original branch", async () => {
  const t = makeT();
  const owner = await makeUser(t);
  const { sceneId, client, openerBeatId } = await seedPlayableScene(t, owner);

  const edited = await client.mutation(api.beats.editFork, {
    beatId: openerBeatId,
    newText: "A different opening line.",
  });
  const undone = await client.mutation(api.actions.undoLast, { sceneId });
  expect(undone.undone).toBe(true);

  const scene = await client.query(api.scenes.get, { sceneId });
  expect(scene.scene.activeTipBeatId).toBe(openerBeatId);

  const newBeat = await client.query(api.beats.getWithOptions, { beatId: edited.newBeatId });
  expect(newBeat?.beat.text).toBe("A different opening line.");
});

test("undoing fact mute and role retire restores them", async () => {
  const t = makeT();
  const owner = await makeUser(t);
  const { sceneId, client, openerBeatId } = await seedPlayableScene(t, owner);

  const roleId = await client.mutation(api.cast.upsertDraftRole, {
    sceneId,
    kind: "ai",
    card: makeCard("Linh"),
  });
  // Note: role was added AFTER play started (mid-story casting) — versioned path.
  const factId = await client.mutation(api.facts.add, {
    sceneId,
    nodeId: openerBeatId,
    text: "The ledger exists.",
  });

  await client.mutation(api.cast.setStatus, { roleId, status: "offstage" });
  await client.mutation(api.facts.setStatus, { factId, status: "muted" });

  await client.mutation(api.actions.undoLast, { sceneId }); // unmute
  await client.mutation(api.actions.undoLast, { sceneId }); // restore role

  const roles = await client.query(api.cast.listRoles, { sceneId, includeInactive: true });
  expect(roles.find((r) => r._id === roleId)?.status).toBe("active");
  const facts = await client.query(api.facts.listForPath, { sceneId });
  expect(facts.some((f) => f._id === factId)).toBe(true);

  const log = await client.query(api.actions.list, { sceneId });
  expect(log.filter((entry) => entry.undoneAt !== null)).toHaveLength(2);
});
