import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { asUser, makeCard, makeT, makeUser, seedScene } from "./helpers";

/**
 * Opening draft action: the audition can reroll the
 * opening before canonizing it, but previews write no beats. Start commits the
 * chosen text through `beats.appendOpening`, which freezes initial role
 * revisions exactly like the streamed opening path.
 */

describe("generation.opening.draft", () => {
  test("previews text without creating a beat, then commits exactly once", async () => {
    const t = makeT();
    const userId = await makeUser(t);
    const { sceneId, client } = await seedScene(t, userId);
    await client.mutation(api.cast.upsertDraftRole, {
      sceneId,
      kind: "ai",
      card: makeCard("Linh"),
    });

    const draft = await client.action(api.generation.opening.draft, { sceneId });
    expect(draft.text.length).toBeGreaterThan(0);
    expect(draft.speakerRoleId).toBeTruthy();

    const before = await client.query(api.beats.listPath, { sceneId });
    expect(before.beats).toHaveLength(0);

    const usage = await client.query(api.usage.getSceneUsage, { sceneId });
    expect(usage.tokensOut).toBeGreaterThan(0);

    const committed = await client.mutation(api.beats.appendOpening, {
      sceneId,
      text: draft.text,
      speakerRoleId: draft.speakerRoleId,
    });
    expect(committed.beatId).toBeTruthy();

    const after = await client.query(api.beats.listPath, { sceneId });
    expect(after.beats).toHaveLength(1);
    expect(after.beats[0]?.text).toBe(draft.text);
    expect(after.beats[0]?.origin).toBe("opening");

    const scene = await client.query(api.scenes.get, { sceneId });
    expect(scene.scene.status).toBe("playing");
    expect(scene.scene.activeTipBeatId).toBe(committed.beatId);

    const roles = await client.query(api.cast.listRoles, { sceneId });
    expect(roles[0]?.currentRevisionId).toBeTruthy();
  });

  test("can be rerolled before start with the tree still untouched", async () => {
    const t = makeT();
    const userId = await makeUser(t);
    const { sceneId, client } = await seedScene(t, userId);
    await client.mutation(api.cast.upsertDraftRole, {
      sceneId,
      kind: "ai",
      card: makeCard("Linh"),
    });

    const first = await client.action(api.generation.opening.draft, { sceneId });
    const second = await client.action(api.generation.opening.draft, { sceneId });
    expect(first.text.length).toBeGreaterThan(0);
    expect(second.text.length).toBeGreaterThan(0);

    const path = await client.query(api.beats.listPath, { sceneId });
    expect(path.beats).toHaveLength(0);
  });

  test("fails cleanly when there is no active AI role", async () => {
    const t = makeT();
    const userId = await makeUser(t);
    const { sceneId, client } = await seedScene(t, userId);

    await expect(
      client.action(api.generation.opening.draft, { sceneId }),
    ).rejects.toThrow(/active AI role/i);
  });

  test("viewers without access cannot preview a scene", async () => {
    const t = makeT();
    const owner = await makeUser(t, "Owner");
    const outsider = await makeUser(t, "Outsider");
    const { sceneId, client } = await seedScene(t, owner);
    await client.mutation(api.cast.upsertDraftRole, {
      sceneId,
      kind: "ai",
      card: makeCard("Linh"),
    });

    // Anonymous/outsider sees nothing: the deploy has no share row for them.
    const intruder = asUser(t, outsider);
    await expect(
      intruder.action(api.generation.opening.draft, { sceneId }),
    ).rejects.toThrow(/access|not found|owner/i);
  });
});
