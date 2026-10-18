// @vitest-environment edge-runtime
import { expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import {
  asUser,
  makeCard,
  makeT,
  makeUser,
  seedPlayableScene,
  type T,
} from "./helpers";

/**
 * Phase 6 backend surface: branch tree, snapshot inspector reads, scene-wide
 * fact ledger with path flags, continuity warnings, and active-path switching.
 */

async function seedTurnedScene(t: T, owner: string) {
  const seeded = await seedPlayableScene(t, owner);
  await seeded.client.mutation(api.cast.upsertDraftRole, {
    sceneId: seeded.sceneId,
    kind: "ai",
    card: makeCard("Linh"),
  });
  await seeded.client.mutation(api.cast.upsertDraftRole, {
    sceneId: seeded.sceneId,
    kind: "ai",
    card: makeCard("Duc"),
  });
  const turn = await seeded.client.action(api.generation.turn.start, {
    sceneId: seeded.sceneId,
  });
  if (turn.status !== "done" || !turn.beatId) {
    throw new Error(`expected a finished turn, got ${turn.status}`);
  }
  return { ...seeded, turnBeatId: turn.beatId };
}

test("branches.tree exposes branches, path ids, beat previews and candidates", async () => {
  const t = makeT();
  const owner = await makeUser(t, "Owner");
  const outsider = await makeUser(t, "Outsider");
  const { sceneId, client, turnBeatId } = await seedTurnedScene(t, owner);

  const tree = await client.query(api.branches.tree, { sceneId });
  expect(tree.branches).toHaveLength(1);
  expect(tree.activeBranchId).toBe(tree.branches[0]?._id);
  expect(tree.activeBeatIds).toContain(turnBeatId);
  expect(tree.activeBeatIds.length).toBe(2);
  const turnNode = tree.beats.find((beat) => beat._id === turnBeatId);
  expect(turnNode?.textPreview.length).toBeGreaterThan(0);
  expect(turnNode?.status).toBe("finished");
  // The turn action auto-offered candidates at the decision point.
  expect(tree.candidates.length).toBeGreaterThanOrEqual(2);
  expect(tree.candidates.every((candidate) => candidate.status === "offered")).toBe(
    true,
  );

  const fork = await client.mutation(api.beats.editFork, {
    beatId: turnBeatId,
    newText: "A different answer entirely.",
  });
  const forked = await client.query(api.branches.tree, { sceneId });
  expect(forked.branches).toHaveLength(2);
  expect(forked.activeBranchId).toBe(fork.branchId);
  expect(forked.activeBeatIds).not.toContain(turnBeatId);
  // Both the original and the fork exist in the tree (law L4).
  expect(forked.beats.map((beat) => beat._id)).toContain(turnBeatId);
  expect(forked.beats.map((beat) => beat._id)).toContain(fork.newBeatId);

  const intruder = asUser(t, outsider);
  await expect(intruder.query(api.branches.tree, { sceneId })).rejects.toThrow(
    /access|owner|not found/i,
  );
});

test("snapshot inspector reads return rendered blocks for beats, candidates and casting", async () => {
  const t = makeT();
  const owner = await makeUser(t, "Owner");
  const { sceneId, client, turnBeatId } = await seedTurnedScene(t, owner);

  const beatSnapshots = await client.query(api.generation.snapshots.getForBeat, {
    beatId: turnBeatId,
  });
  expect(beatSnapshots?.length).toBeGreaterThanOrEqual(1);
  // Both the turn itself and the decision-point options link to this beat.
  expect(beatSnapshots?.map((snapshot) => snapshot.mode)).toContain("turn");
  expect(beatSnapshots?.map((snapshot) => snapshot.mode)).toContain("options");
  const beatSnapshot = beatSnapshots?.find((snapshot) => snapshot.mode === "turn");
  expect(beatSnapshot?.blocks.length).toBeGreaterThanOrEqual(6);
  const contract = beatSnapshot?.blocks.find((block) => block.key === "contract");
  expect(contract?.text.length).toBeGreaterThan(20);
  expect(contract?.hash.length).toBeGreaterThanOrEqual(8);
  expect(beatSnapshot?.tokenCounts.total).toBeGreaterThan(0);

  const candidates = await client.query(api.candidates.listForScene, { sceneId });
  expect(candidates.length).toBeGreaterThanOrEqual(2);
  const candidateSnapshots = await client.query(
    api.generation.snapshots.getForCandidate,
    { candidateId: candidates[0]!._id },
  );
  expect(candidateSnapshots?.[0]?.mode).toBe("options");

  // Casting snapshots carry no beat/candidate; the scene index must surface
  // them for the inspector fallback view.
  await t.mutation(internal.generation.snapshots.write, {
    sceneId,
    mode: "casting",
    blocks: [
      {
        key: "mode",
        templateKey: "meta.casting",
        templateVersion: 1,
        text: "Cast the scene.",
        hash: "abc12345",
        tokens: 4,
        chars: 15,
      },
    ],
    model: { provider: "fake", modelId: "fake", params: {} },
    tokenCounts: { system: 4, context: 0, outputReserve: 0, total: 4 },
    budget: { contextWindow: 128000, systemTargetPct: 25 },
  });
  const recent = await client.query(api.generation.snapshots.listForScene, { sceneId });
  expect(recent.map((row) => row.mode)).toContain("casting");
  const casting = recent.find((row) => row.mode === "casting");
  expect(casting?.blocks[0]?.text).toBe("Cast the scene.");

  const outsider = asUser(t, await makeUser(t, "Outsider"));
  await expect(
    outsider.query(api.generation.snapshots.getForBeat, { beatId: turnBeatId }),
  ).rejects.toThrow(/access|owner|not found/i);
});

test("facts.listForScene flags path membership, mute and global pins", async () => {
  const t = makeT();
  const owner = await makeUser(t, "Owner");
  const { sceneId, client, turnBeatId } = await seedTurnedScene(t, owner);

  const pathFactId = await client.mutation(api.facts.add, {
    sceneId,
    nodeId: turnBeatId,
    text: "FACT_A_9C1 the ledger is a forgery.",
  });
  await client.mutation(api.facts.setStatus, {
    factId: pathFactId,
    status: "muted",
  });

  const fork = await client.mutation(api.beats.editFork, {
    beatId: turnBeatId,
    newText: "A different answer entirely.",
  });
  const offPathFactId = await client.mutation(api.facts.add, {
    sceneId,
    nodeId: turnBeatId, // original beat is now off the active path
    text: "FACT_B_44E the ledger is real.",
  });
  await client.mutation(api.facts.setPinned, {
    factId: offPathFactId,
    pinned: true,
  });

  const facts = await client.query(api.facts.listForScene, { sceneId });
  const muted = facts.find((fact) => fact._id === pathFactId);
  expect(muted?.onPath).toBe(false); // muted facts are never in context
  expect(muted?.inContext).toBe(false);
  const pinned = facts.find((fact) => fact._id === offPathFactId);
  expect(pinned?.onPath).toBe(false); // node is not on the new path…
  expect(pinned?.inContext).toBe(true); // …but global pins cross paths (ADR-001)

  // Switching back to the original path restores fact A's path membership.
  const tree = await client.query(api.branches.tree, { sceneId });
  const mainBranch = tree.branches.find(
    (branch) => branch._id !== fork.branchId,
  );
  if (!mainBranch?.tipBeatId) throw new Error("main tip missing");
  await client.mutation(api.branches.setActive, {
    sceneId,
    tipBeatId: mainBranch.tipBeatId,
  });
  const restored = await client.query(api.facts.listForScene, { sceneId });
  expect(restored.find((fact) => fact._id === pathFactId)?.onPath).toBe(true);
});

test("continuity warnings list, dismiss and undo back to open", async () => {
  const t = makeT();
  const owner = await makeUser(t, "Owner");
  const { sceneId, client, openerBeatId } = await seedPlayableScene(t, owner);

  const warningId = await t.run(
    async (ctx) =>
      await ctx.db.insert("continuityWarnings", {
        sceneId: sceneId as never,
        beatId: openerBeatId as never,
        text: "WARNING_TOKEN timeline is ambiguous here",
        severity: "medium",
        status: "open",
        createdAt: 1,
      }),
  );

  const open = await client.query(api.warnings.listForScene, { sceneId });
  expect(open).toHaveLength(1);
  expect(open[0]?.text).toContain("WARNING_TOKEN");

  await client.mutation(api.warnings.dismiss, { warningId });
  expect(await client.query(api.warnings.listForScene, { sceneId })).toHaveLength(0);
  const all = await client.query(api.warnings.listForScene, {
    sceneId,
    includeDismissed: true,
  });
  expect(all[0]?.status).toBe("dismissed");

  await client.mutation(api.actions.undoLast, { sceneId });
  const undone = await client.query(api.warnings.listForScene, { sceneId });
  expect(undone).toHaveLength(1);
  expect(undone[0]?.status).toBe("open");

  const outsider = asUser(t, await makeUser(t, "Outsider"));
  await expect(
    outsider.query(api.warnings.listForScene, { sceneId }),
  ).rejects.toThrow(/access|owner|not found/i);
});

test("branch switching recomputes the projected fact set", async () => {
  const t = makeT();
  const owner = await makeUser(t, "Owner");
  const { sceneId, client, turnBeatId } = await seedTurnedScene(t, owner);

  await client.mutation(api.facts.add, {
    sceneId,
    nodeId: turnBeatId,
    text: "FACT_MAIN_ONLY",
  });
  const fork = await client.mutation(api.beats.editFork, {
    beatId: turnBeatId,
    newText: "Forked answer.",
  });
  await client.mutation(api.facts.add, {
    sceneId,
    nodeId: fork.newBeatId,
    text: "FACT_FORK_ONLY",
  });

  const onFork = await client.query(api.facts.listForPath, { sceneId });
  expect(onFork.map((fact) => fact.text)).toEqual(["FACT_FORK_ONLY"]);

  const tree = await client.query(api.branches.tree, { sceneId });
  const main = tree.branches.find((branch) => branch._id !== fork.branchId);
  if (!main?.tipBeatId) throw new Error("main tip missing");
  await client.mutation(api.branches.setActive, {
    sceneId,
    tipBeatId: main.tipBeatId,
  });
  const onMain = await client.query(api.facts.listForPath, { sceneId });
  expect(onMain.map((fact) => fact.text)).toEqual(["FACT_MAIN_ONLY"]);
});
