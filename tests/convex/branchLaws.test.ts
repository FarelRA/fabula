// @vitest-environment edge-runtime
import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { makeT, makeUser, seedPlayableScene } from "./helpers";

/**
 * Branch laws attach, fork-on-edit against the real Convex runtime (convex-test).
 *.1, gate G1.
 */

describe("branch laws (integration)", () => {
  test("extend: picking at the active tip extends the current branch", async () => {
    const t = makeT();
    const owner = await makeUser(t);
    const { sceneId, branchId, client, openerBeatId } = await seedPlayableScene(t, owner);

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
    expect(first).toBeDefined();
    if (!first) throw new Error("expected at least one option");

    const picked = await client.mutation(api.candidates.pick, { candidateId: first._id });
    expect(picked.forked).toBe(false);
    expect(picked.branchId).toBe(branchId);

    const scene = await client.query(api.scenes.get, { sceneId });
    expect(scene.scene.activeTipBeatId).toBe(picked.beatId);
    expect(scene.scene.activeBranchId).toBe(branchId);

    const branches = await client.query(api.branches.list, { sceneId });
    expect(branches).toHaveLength(1);
  });

  test("fork-from-ghost: picking a ghost candidate forks from its parent and preserves the original beat", async () => {
    const t = makeT();
    const owner = await makeUser(t);
    const { sceneId, client, openerBeatId } = await seedPlayableScene(t, owner);

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

    const canon = await client.mutation(api.candidates.pick, { candidateId: first._id });

    // The second candidate's parent (the opener) is no longer the tip: ghost pick forks.
    const forked = await client.mutation(api.candidates.pick, { candidateId: second._id });
    expect(forked.forked).toBe(true);
    expect(forked.branchId).not.toBe(canon.branchId);

    const branches = await client.query(api.branches.list, { sceneId });
    expect(branches).toHaveLength(2);
    const forkBranch = branches.find((b) => b._id === forked.branchId);
    expect(forkBranch?.forkedFromBeatId).toBe(openerBeatId);
    expect(forkBranch?.forkReason).toBe("pick");

    // Original canon beat is untouched and still on the main branch.
    const original = await client.query(api.beats.getWithOptions, { beatId: canon.beatId });
    expect(original?.beat.branchId).toBe(canon.branchId);
    expect(original?.beat.text).toBe("She pushes the door.");

    // Active path is opener → forked beat.
    const path = await client.query(api.beats.listPath, { sceneId });
    expect(path.beats.map((b) => b._id)).toEqual([openerBeatId, forked.beatId]);
  });

  test("fork-on-edit: editFork preserves the original and forks from its parent", async () => {
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

    const edited = await client.mutation(api.beats.editFork, {
      beatId: picked.beatId,
      newText: "She steps back instead.",
    });

    // New branch forks from the EDITED beat's parent (the opener), not the beat.
    const branches = await client.query(api.branches.list, { sceneId });
    const forkBranch = branches.find((b) => b._id === edited.branchId);
    expect(forkBranch?.forkedFromBeatId).toBe(openerBeatId);
    expect(forkBranch?.forkReason).toBe("edit");

    // Original beat intact on its branch.
    const original = await client.query(api.beats.getWithOptions, { beatId: picked.beatId });
    expect(original?.beat.text).toBe("She pushes the door.");
    expect(original?.beat.branchId).toBe(picked.branchId);

    // New beat records provenance and is the active tip.
    const newBeat = await client.query(api.beats.getWithOptions, { beatId: edited.newBeatId });
    expect(newBeat?.beat.editedFromBeatId).toBe(picked.beatId);
    const scene = await client.query(api.scenes.get, { sceneId });
    expect(scene.scene.activeTipBeatId).toBe(edited.newBeatId);
    expect(scene.scene.activeBranchId).toBe(edited.branchId);
  });

  test("fork-on-edit: regenerateFork behaves like editFork", async () => {
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

    const regenerated = await client.mutation(api.beats.regenerateFork, {
      beatId: picked.beatId,
      text: "Different version of the same beat.",
    });
    const branches = await client.query(api.branches.list, { sceneId });
    const forkBranch = branches.find((b) => b._id === regenerated.branchId);
    expect(forkBranch?.forkReason).toBe("regenerate");
    const newBeat = await client.query(api.beats.getWithOptions, { beatId: regenerated.newBeatId });
    expect(newBeat?.beat.regenerateOfBeatId).toBe(picked.beatId);
    const original = await client.query(api.beats.getWithOptions, { beatId: picked.beatId });
    expect(original?.beat.text).toBe("She pushes the door.");
  });

  test("switching branches recomputes the active path instantly (path isolation, no regeneration)", async () => {
    const t = makeT();
    const owner = await makeUser(t);
    const { sceneId, client, openerBeatId } = await seedPlayableScene(t, owner);

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
    const canon = await client.mutation(api.candidates.pick, { candidateId: first._id });
    const forked = await client.mutation(api.candidates.pick, { candidateId: second._id });

    await client.mutation(api.branches.setActive, { sceneId, tipBeatId: canon.beatId });
    const path = await client.query(api.beats.listPath, { sceneId });
    expect(path.beats.map((b) => b._id)).toEqual([openerBeatId, canon.beatId]);

    await client.mutation(api.branches.setActive, { sceneId, tipBeatId: forked.beatId });
    const path2 = await client.query(api.beats.listPath, { sceneId });
    expect(path2.beats.map((b) => b._id)).toEqual([openerBeatId, forked.beatId]);
  });
});
