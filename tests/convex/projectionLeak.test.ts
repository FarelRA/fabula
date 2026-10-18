// @vitest-environment edge-runtime
import { expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { makeT, makeUser, seedPlayableScene, type T } from "./helpers";

/**
 * The crown jewel: memory is projected along the active
 * path. Switching branches must never leak unpinned facts, private data, or
 * summaries from the other path. Pinned facts are explicit global canon
 * overrides.
 */

async function seedTwoBranchScene(t: T, owner: string) {
  const { sceneId, client, openerBeatId } = await seedPlayableScene(t, owner);
  await client.mutation(api.facts.add, {
    sceneId,
    nodeId: openerBeatId,
    text: "TOKEN_OPENER the rain is real.",
  });
  await client.mutation(api.candidates.createBatch, {
    sceneId,
    parentBeatId: openerBeatId,
    options: [
      { label: "Push inside", text: "She pushes the door.", strategy: "escalate" },
      { label: "Wait outside", text: "She waits under the awning.", strategy: "deflect" },
    ],
  });
  const options = await client.query(api.candidates.listForBeat, { beatId: openerBeatId });
  const first = options?.[0];
  const second = options?.[1];
  if (!first || !second) throw new Error("expected two options");

  const canonA = await client.mutation(api.candidates.pick, { candidateId: first._id });
  await client.mutation(api.facts.add, {
    sceneId,
    nodeId: canonA.beatId,
    text: "TOKEN_BRANCH_A the key is missing.",
  });
  const forkedB = await client.mutation(api.candidates.pick, { candidateId: second._id });
  await client.mutation(api.facts.add, {
    sceneId,
    nodeId: forkedB.beatId,
    text: "TOKEN_BRANCH_B the window is open.",
  });

  return { sceneId, client, openerBeatId, canonABeatId: canonA.beatId, forkedBBeatId: forkedB.beatId };
}

test("facts never leak across branches (unpinned)", async () => {
  const t = makeT();
  const owner = await makeUser(t);
  const { sceneId, client, canonABeatId } = await seedTwoBranchScene(t, owner);

  // Active path is branch B.
  const onB = await client.query(api.facts.listForPath, { sceneId });
  const bTexts = onB.map((f) => f.text);
  expect(bTexts.some((text) => text.includes("TOKEN_OPENER"))).toBe(true);
  expect(bTexts.some((text) => text.includes("TOKEN_BRANCH_B"))).toBe(true);
  expect(bTexts.some((text) => text.includes("TOKEN_BRANCH_A"))).toBe(false);

  // Switch back to branch A.
  await client.mutation(api.branches.setActive, { sceneId, tipBeatId: canonABeatId });
  const onA = await client.query(api.facts.listForPath, { sceneId });
  const aTexts = onA.map((f) => f.text);
  expect(aTexts.some((text) => text.includes("TOKEN_BRANCH_A"))).toBe(true);
  expect(aTexts.some((text) => text.includes("TOKEN_BRANCH_B"))).toBe(false);
});

test("pinned facts are explicit global overrides; muted facts vanish", async () => {
  const t = makeT();
  const owner = await makeUser(t);
  const { sceneId, client, canonABeatId } = await seedTwoBranchScene(t, owner);

  // Switch to branch A to see its (unpinned) fact, then pin it.
  await client.mutation(api.branches.setActive, { sceneId, tipBeatId: canonABeatId });
  const onA = await client.query(api.facts.listForPath, { sceneId });
  const aFact = onA.find((f) => f.text.includes("TOKEN_BRANCH_A"));
  expect(aFact).toBeDefined();
  if (!aFact) throw new Error("expected branch A fact");
  await client.mutation(api.facts.setPinned, { factId: aFact._id, pinned: true });

  const onBPinned = await client.query(api.facts.listForPath, { sceneId });
  const pinnedVisible = onBPinned.find((f) => f.text.includes("TOKEN_BRANCH_A"));
  expect(pinnedVisible?.isPinned).toBe(true);

  // Unpin + mute: the fact disappears from its own path too.
  await client.mutation(api.facts.setPinned, { factId: aFact._id, pinned: false });
  await client.mutation(api.facts.setStatus, { factId: aFact._id, status: "muted" });
  await client.mutation(api.branches.setActive, { sceneId, tipBeatId: canonABeatId });
  const muted = await client.query(api.facts.listForPath, { sceneId });
  expect(muted.some((f) => f.text.includes("TOKEN_BRANCH_A"))).toBe(false);
});

test("summaries apply only when their end beat is on the active path", async () => {
  const t = makeT();
  const owner = await makeUser(t);
  const { sceneId, client, openerBeatId, canonABeatId } = await seedTwoBranchScene(t, owner);

  await t.mutation(internal.summaries.add, {
    sceneId,
    coveredFromSeq: 1,
    coveredThroughBeatId: openerBeatId,
    text: "SUMMARY_OPENER the knock happened.",
  });
  await t.mutation(internal.summaries.add, {
    sceneId,
    coveredFromSeq: 2,
    coveredThroughBeatId: canonABeatId,
    text: "SUMMARY_BRANCH_A the door opened.",
  });

  // Active path is B: only the opener summary.
  const onB = await client.query(api.summaries.listForPath, { sceneId });
  const bTexts = onB.map((s) => s.text);
  expect(bTexts.some((text) => text.includes("SUMMARY_OPENER"))).toBe(true);
  expect(bTexts.some((text) => text.includes("SUMMARY_BRANCH_A"))).toBe(false);

  // Active path is A: both.
  await client.mutation(api.branches.setActive, { sceneId, tipBeatId: canonABeatId });
  const onA = await client.query(api.summaries.listForPath, { sceneId });
  const aTexts = onA.map((s) => s.text);
  expect(aTexts.some((text) => text.includes("SUMMARY_OPENER"))).toBe(true);
  expect(aTexts.some((text) => text.includes("SUMMARY_BRANCH_A"))).toBe(true);
});
