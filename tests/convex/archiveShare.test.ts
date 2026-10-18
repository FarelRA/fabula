// @vitest-environment edge-runtime
import { expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  asUser,
  defaultSettings,
  makeCard,
  makeT,
  makeUser,
  seedPlayableScene,
  type T,
} from "./helpers";

/**
 * Archive and share backend surface: wrap and freeze with end detection, share links with
 * viewer/director tokens, the export bundle and presence wrappers.
 */

async function seedTurnedScene(t: T, owner: string) {
  const seeded = await seedPlayableScene(t, owner);
  await seeded.client.mutation(api.cast.upsertDraftRole, {
    sceneId: seeded.sceneId,
    kind: "ai",
    card: makeCard("Linh"),
  });
  const turn = await seeded.client.action(api.generation.turn.start, {
    sceneId: seeded.sceneId,
  });
  if (turn.status !== "done" || !turn.beatId) {
    throw new Error(`expected a finished turn, got ${turn.status}`);
  }
  return { ...seeded, turnBeatId: turn.beatId };
}

test("wrap: endScene archives, runs the final summary and is undoable", async () => {
  const t = makeT();
  const owner = await makeUser(t, "Owner");
  const { sceneId, client, turnBeatId } = await seedTurnedScene(t, owner);

  const result = await client.mutation(api.scenes.endScene, { sceneId });
  expect(result.archived).toBe(true);
  await t.finishAllScheduledFunctions(() => {});

  const after = await client.query(api.scenes.get, { sceneId });
  expect(after.scene.status).toBe("archived");
  expect(after.scene.endedAt).toBeGreaterThan(0);

  // The wrap pass summarized the uncovered tail (opener + turn).
  const summaries = await client.query(api.summaries.listForPath, { sceneId });
  expect(summaries.length).toBeGreaterThanOrEqual(1);
  expect(summaries[0]?.coveredThroughSeq).toBeGreaterThanOrEqual(2);

  // Logged with a reversible inverse.
  const actions = await client.query(api.actions.list, { sceneId, limit: 1 });
  expect(actions[0]?.type).toBe("scene.end");
  expect(actions[0]?.undoneAt).toBeNull();

  await client.mutation(api.actions.undoLast, { sceneId });
  const reopened = await client.query(api.scenes.get, { sceneId });
  expect(reopened.scene.status).toBe("playing");
  expect(reopened.scene.endedAt).toBeUndefined();

  // Idempotent: ending an already-archived scene is a no-op.
  await client.mutation(api.scenes.endScene, { sceneId });
  const again = await client.mutation(api.scenes.endScene, { sceneId });
  expect(again.archived).toBe(false);
  expect(turnBeatId).toBeTruthy();
});

test("archived scenes freeze story mutations; undo reopens them", async () => {
  const t = makeT();
  const owner = await makeUser(t, "Owner");
  const { sceneId, client, turnBeatId } = await seedTurnedScene(t, owner);
  const roles = await client.query(api.cast.listRoles, { sceneId });
  const roleId = roles[0]!._id;
  const candidateIds = await client.mutation(api.candidates.createBatch, {
    sceneId,
    parentBeatId: turnBeatId,
    options: [
      { label: "Push inside", text: "She pushes the door.", strategy: "escalate" },
      { label: "Wait outside", text: "She waits under the awning.", strategy: "deflect" },
    ],
  });

  await client.mutation(api.scenes.endScene, { sceneId });
  await t.finishAllScheduledFunctions(() => {});

  await expect(
    client.mutation(api.candidates.pick, { candidateId: candidateIds[0]! }),
  ).rejects.toThrow(/archived/i);
  await expect(
    client.mutation(api.candidates.dismiss, { candidateId: candidateIds[1]! }),
  ).rejects.toThrow(/archived/i);
  await expect(
    client.mutation(api.beats.editFork, { beatId: turnBeatId, newText: "x" }),
  ).rejects.toThrow(/archived/i);
  await expect(
    client.mutation(api.beats.pin, { beatId: turnBeatId, pinned: true }),
  ).rejects.toThrow(/archived/i);
  await expect(
    client.mutation(api.facts.add, {
      sceneId,
      nodeId: turnBeatId,
      text: "FACT_FROZEN",
    }),
  ).rejects.toThrow(/archived/i);
  await expect(
    client.mutation(api.branches.setActive, { sceneId, tipBeatId: turnBeatId }),
  ).rejects.toThrow(/archived/i);
  await expect(
    client.mutation(api.directorNotes.add, {
      sceneId,
      kind: "steer",
      text: "Raise the stakes.",
    }),
  ).rejects.toThrow(/archived/i);
  await expect(
    client.mutation(api.cast.setStatus, { roleId, status: "offstage" }),
  ).rejects.toThrow(/archived/i);
  await expect(
    client.mutation(api.scenes.rename, { sceneId, title: "Renamed after the end" }),
  ).rejects.toThrow(/archived/i);
  await expect(
    client.mutation(api.scenes.updateSettings, {
      sceneId,
      patch: { branchFrequency: "always" },
    }),
  ).rejects.toThrow(/archived/i);
  await expect(
    client.action(api.generation.turn.start, { sceneId }),
  ).rejects.toThrow(/archived/i);
  await expect(
    client.action(api.generation.options.offer, {
      sceneId,
      parentBeatId: turnBeatId,
    }),
  ).rejects.toThrow(/archived/i);

  // Reversibility: undo the wrap and the same pick now succeeds.
  await client.mutation(api.actions.undoLast, { sceneId });
  const picked = await client.mutation(api.candidates.pick, {
    candidateId: candidateIds[0]!,
  });
  expect(picked.beatId).toBeTruthy();
});

test("end detection: consecutive meta suggestions build the ending streak", async () => {
  const t = makeT();
  const owner = await makeUser(t, "Owner");
  const client = asUser(t, owner);
  await client.mutation(api.prompts.seed.seedV1, {});
  const created = await client.mutation(api.scenes.create, {
    title: "The Long Night",
    premise: "A quiet resolution is coming.",
    settings: defaultSettings(),
  });
  const { sceneId } = created;
  await client.mutation(api.cast.upsertDraftRole, {
    sceneId,
    kind: "ai",
    card: makeCard("Linh"),
  });
  await client.mutation(api.cast.upsertDraftRole, {
    sceneId,
    kind: "ai",
    card: makeCard("Duc"),
  });
  await client.mutation(api.beats.appendOpening, {
    sceneId,
    text: "Rain hadn't stopped for three days.",
  });

  // The fake gateway flags endings when the marker is in the director prompt;
  // recent beats feed it, so an explicit line steers two consecutive metas.
  await client.mutation(api.beats.appendUserBeat, {
    sceneId,
    text: "This is where the story could end. [[fake:ending]]",
  });
  const first = await client.action(api.generation.turn.start, { sceneId });
  expect(first.status).toBe("done");
  const afterOne = await client.query(api.scenes.get, { sceneId });
  expect(afterOne.scene.endingStreak).toBe(1);

  const second = await client.action(api.generation.turn.start, { sceneId });
  expect(second.status).toBe("done");
  const afterTwo = await client.query(api.scenes.get, { sceneId });
  expect(afterTwo.scene.endingStreak).toBe(2);

  // A meta result that stops suggesting endings resets the streak.
  await t.mutation(internal.scenes.recordEndingSignal, { sceneId, suggested: false });
  const reset = await client.query(api.scenes.get, { sceneId });
  expect(reset.scene.endingStreak).toBe(0);
});

test("share tokens: viewer streams read-only; director tokens may pick", async () => {
  const t = makeT();
  const owner = await makeUser(t, "Owner");
  const { sceneId, client, turnBeatId } = await seedTurnedScene(t, owner);
  const candidateIds = await client.mutation(api.candidates.createBatch, {
    sceneId,
    parentBeatId: turnBeatId,
    options: [
      { label: "Push inside", text: "She pushes the door.", strategy: "escalate" },
      { label: "Wait outside", text: "She waits under the awning.", strategy: "deflect" },
    ],
  });

  const viewer = await client.mutation(api.shares.create, {
    sceneId,
    permission: "viewer",
  });
  const director = await client.mutation(api.shares.create, {
    sceneId,
    permission: "director",
  });

  // No identity at all: the token is the credential.
  const bundle = await t.query(api.shares.getByToken, { token: viewer.token });
  expect(bundle?.permission).toBe("viewer");
  // The turn auto-offered paths at the tip; the batch adds two more.
  expect(bundle?.options.length).toBeGreaterThanOrEqual(2);
  expect(bundle?.options.every((option) => option.parentIsTip)).toBe(true);
  expect(bundle?.pending).toEqual([]);
  expect(bundle?.notes).toEqual([]);
  expect(bundle?.run).toBeNull();

  // Token-scoped streaming works without identity.
  const scene = await client.query(api.scenes.get, { sceneId });
  const threadId = scene.scene.threadId!;
  const page = await t.query(api.thread.listMessages, {
    sceneId,
    threadId,
    paginationOpts: { cursor: null, numItems: 10 },
    streamArgs: { kind: "list", startOrder: 0 },
    shareToken: viewer.token,
  });
  expect(page.streams && page.streams.kind).toBe("list");

  // Viewer tokens cannot pick; director tokens can (no identity required).
  await expect(
    t.mutation(api.candidates.pick, {
      candidateId: candidateIds[0]!,
      shareToken: viewer.token,
    }),
  ).rejects.toThrow(/view-only/i);
  const picked = await t.mutation(api.candidates.pick, {
    candidateId: candidateIds[0]!,
    shareToken: director.token,
  });
  expect(picked.beatId).toBeTruthy();
  const afterPick = await client.query(api.beats.listPath, { sceneId });
  expect(afterPick.beats.at(-1)?._id).toBe(picked.beatId);

  // Unknown and revoked tokens fail closed.
  await expect(
    t.mutation(api.candidates.pick, {
      candidateId: candidateIds[1]!,
      shareToken: "nope",
    }),
  ).rejects.toThrow(/not valid/i);
  await client.mutation(api.shares.revoke, { shareId: viewer.shareId });
  await expect(
    t.query(api.thread.listMessages, {
      sceneId,
      threadId,
      paginationOpts: { cursor: null, numItems: 10 },
      streamArgs: { kind: "list", startOrder: 0 },
      shareToken: viewer.token,
    }),
  ).rejects.toThrow(/revoked/i);

  // Expired links read as missing and reject streaming.
  const expired = await client.mutation(api.shares.create, {
    sceneId,
    permission: "viewer",
    expiresAt: 1000,
  });
  expect(await t.query(api.shares.getByToken, { token: expired.token })).toBeNull();
  await expect(
    t.query(api.thread.listMessages, {
      sceneId,
      threadId,
      paginationOpts: { cursor: null, numItems: 10 },
      streamArgs: { kind: "list", startOrder: 0 },
      shareToken: expired.token,
    }),
  ).rejects.toThrow(/expired/i);
});

test("archived scenes stay readable through share links but freeze picking", async () => {
  const t = makeT();
  const owner = await makeUser(t, "Owner");
  const { sceneId, client, turnBeatId } = await seedTurnedScene(t, owner);
  const candidateIds = await client.mutation(api.candidates.createBatch, {
    sceneId,
    parentBeatId: turnBeatId,
    options: [
      { label: "Push inside", text: "She pushes the door.", strategy: "escalate" },
      { label: "Wait outside", text: "She waits under the awning.", strategy: "deflect" },
    ],
  });
  const director = await client.mutation(api.shares.create, {
    sceneId,
    permission: "director",
  });
  await client.mutation(api.scenes.endScene, { sceneId });
  await t.finishAllScheduledFunctions(() => {});

  const bundle = await t.query(api.shares.getByToken, { token: director.token });
  expect(bundle?.scene.status).toBe("archived");
  await expect(
    t.mutation(api.candidates.pick, {
      candidateId: candidateIds[0]!,
      shareToken: director.token,
    }),
  ).rejects.toThrow(/archived/i);
});

test("export bundle is tree-lossless; snapshots are optional", async () => {
  const t = makeT();
  const owner = await makeUser(t, "Owner");
  const outsider = await makeUser(t, "Outsider");
  const { sceneId, client, turnBeatId } = await seedTurnedScene(t, owner);

  const fork = await client.mutation(api.beats.editFork, {
    beatId: turnBeatId,
    newText: "A different answer entirely.",
  });
  await client.mutation(api.facts.add, {
    sceneId,
    nodeId: turnBeatId,
    text: "FACT_ARCHIVED the ledger is a forgery.",
  });
  await client.mutation(api.facts.add, {
    sceneId,
    nodeId: fork.newBeatId,
    text: "FACT_FORK the ledger is real.",
  });

  const bundle = await client.query(api.exportScene.getBundle, { sceneId });
  expect(bundle.format).toBe("fabula.scene");
  expect(bundle.version).toBe(1);
  expect(bundle.branches.length).toBe(2);
  expect(bundle.beats.length).toBeGreaterThanOrEqual(3);
  expect(bundle.candidates.length).toBeGreaterThanOrEqual(2);
  expect(bundle.facts.map((fact) => fact.text)).toEqual(
    expect.arrayContaining(["FACT_ARCHIVED the ledger is a forgery.", "FACT_FORK the ledger is real."]),
  );
  // Parent links survive the round-trip (lossless tree).
  const forked = bundle.beats.find((beat) => beat._id === fork.newBeatId);
  expect(forked?.editedFromBeatId).toBe(turnBeatId);
  const original = bundle.beats.find((beat) => beat._id === turnBeatId);
  expect(original?.text).toContain("rain");
  expect("snapshots" in bundle).toBe(false);

  const withSnapshots = await client.query(api.exportScene.getBundle, {
    sceneId,
    includeSnapshots: true,
  });
  expect(withSnapshots.snapshots?.length).toBeGreaterThanOrEqual(1);
  expect(withSnapshots.snapshots?.[0]?.blocks[0]?.text.length).toBeGreaterThan(0);

  const intruder = asUser(t, outsider);
  await expect(intruder.query(api.exportScene.getBundle, { sceneId })).rejects.toThrow(
    /access|owner|not found/i,
  );
});

test("presence rooms are share tokens; revoked tokens cannot join", async () => {
  const t = makeT();
  const owner = await makeUser(t, "Owner");
  const { sceneId, client } = await seedPlayableScene(t, owner);
  const share = await client.mutation(api.shares.create, {
    sceneId,
    permission: "viewer",
  });

  const beat = await t.mutation(api.presence.heartbeat, {
    roomId: share.token,
    userId: "Viewer 1",
    sessionId: "session-1",
    interval: 10_000,
  });
  expect(beat.sessionToken).toBeTruthy();
  const viewers = await t.query(api.presence.list, { roomToken: beat.roomToken });
  expect(viewers?.length).toBeGreaterThanOrEqual(1);
  expect(viewers?.[0]?.userId).toBe("Viewer 1");

  await client.mutation(api.shares.revoke, { shareId: share.shareId });
  await expect(
    t.mutation(api.presence.heartbeat, {
      roomId: share.token,
      userId: "Viewer 2",
      sessionId: "session-2",
      interval: 10_000,
    }),
  ).rejects.toThrow(/revoked/i);
});

test("scenes.get keeps working for archived reads and unsets fields on undo", async () => {
  const t = makeT();
  const owner = await makeUser(t, "Owner");
  const { sceneId, client } = await seedPlayableScene(t, owner);

  await client.mutation(api.scenes.setStatus, { sceneId, status: "paused" });
  await client.mutation(api.scenes.endScene, { sceneId });
  await t.finishAllScheduledFunctions(() => {});
  await expect(
    client.mutation(api.scenes.setStatus, { sceneId, status: "playing" }),
  ).rejects.toThrow(/archived/i);

  await client.mutation(api.actions.undoLast, { sceneId });
  const scene = await client.query(api.scenes.get, { sceneId });
  expect(scene.scene.status).toBe("paused");
  expect(scene.scene.endedAt).toBeUndefined();
  void (scene.scene.endingStreak satisfies number | undefined);

  // Sanity: sceneId typing helper compiles against the generated data model.
  const typed: Id<"scenes"> = sceneId;
  expect(typed).toBe(sceneId);
});
