// @vitest-environment edge-runtime
import { describe, expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import {
  asUser,
  makeAnonymousUser,
  makeT,
  makeUser,
  seedPlayableScene,
  seedScene,
} from "./helpers";

describe("share links + access control", () => {
  test("viewer tokens read a live bundle without identity; revoke kills it", async () => {
    const t = makeT();
    const owner = await makeUser(t);
    const { sceneId, client, openerBeatId } = await seedPlayableScene(t, owner);

    const share = await client.mutation(api.shares.create, { sceneId, permission: "viewer" });

    // No identity: the token is the only credential.
    const bundle = await t.query(api.shares.getByToken, { token: share.token });
    expect(bundle).not.toBeNull();
    expect(bundle?.scene._id).toBe(sceneId);
    expect(bundle?.beats.map((b) => b._id)).toEqual([openerBeatId]);
    expect(bundle?.permission).toBe("viewer");

    await client.mutation(api.shares.revoke, { shareId: share.shareId });
    const revoked = await t.query(api.shares.getByToken, { token: share.token });
    expect(revoked).toBeNull();
  });

  test("unknown tokens return null", async () => {
    const t = makeT();
    const bundle = await t.query(api.shares.getByToken, { token: "nope" });
    expect(bundle).toBeNull();
  });

  test("non-owners cannot read or mutate a scene", async () => {
    const t = makeT();
    const owner = await makeUser(t, "Owner");
    const intruder = await makeUser(t, "Intruder");
    const { sceneId, openerBeatId } = await seedPlayableScene(t, owner);

    const intruderClient = asUser(t, intruder);
    await expect(intruderClient.query(api.scenes.get, { sceneId })).rejects.toThrow(/access/i);
    await expect(
      intruderClient.mutation(api.candidates.createBatch, {
        sceneId,
        parentBeatId: openerBeatId,
        options: [{ label: "Sneak in", text: "…", strategy: "escalate" }],
      }),
    ).rejects.toThrow(/access/i);
    await expect(intruderClient.mutation(api.actions.undoLast, { sceneId })).rejects.toThrow(
      /access/i,
    );
  });

  test("anonymous scene ownership transfers via claimScene", async () => {
    const t = makeT();
    const anon = await makeAnonymousUser(t);
    const seeded = await seedScene(t, anon);
    const claimant = await makeUser(t, "Real user");
    const claimantClient = asUser(t, claimant);

    const first = await claimantClient.mutation(api.claim.claimScene, {
      sceneId: seeded.sceneId,
    });
    expect(first.claimed).toBe(true);
    const scene = await claimantClient.query(api.scenes.get, { sceneId: seeded.sceneId });
    expect(scene.scene.ownerId).toBe(claimant);

    // A second claim is a no-op (owner no longer anonymous).
    const second = await claimantClient.mutation(api.claim.claimScene, {
      sceneId: seeded.sceneId,
    });
    expect(second.claimed).toBe(false);
  });
});

describe("usage ledger + rollup", () => {
  test("records events and accumulates the per-scene rollup with cost estimates", async () => {
    const t = makeT();
    const owner = await makeUser(t);
    const { sceneId, client } = await seedPlayableScene(t, owner);

    const first = await t.mutation(internal.usage.record, {
      sceneId,
      tier: "spotlight",
      provider: "openai",
      modelId: "gpt-4.1",
      kind: "turn",
      tokensIn: 1_000,
      tokensOut: 500,
    });
    expect(first.costEstimateUsd).toBeCloseTo(0.006, 6);

    await t.mutation(internal.usage.record, {
      sceneId,
      tier: "cheap",
      provider: "openai",
      modelId: "gpt-4.1-nano",
      kind: "directorMeta",
      tokensIn: 2_000,
      tokensOut: 1_000,
    });

    const usage = await client.query(api.usage.getSceneUsage, { sceneId });
    expect(usage.tokensIn).toBe(3_000);
    expect(usage.tokensOut).toBe(1_500);
    expect(usage.costEstimateUsd).toBeCloseTo(0.0066, 6);
    const byTier = usage.byTier as Record<string, { tokensIn: number }>;
    expect(byTier.spotlight?.tokensIn).toBe(1_000);
    expect(byTier.cheap?.tokensIn).toBe(2_000);
  });

  test("usage is inaccessible to non-owners", async () => {
    const t = makeT();
    const owner = await makeUser(t, "Owner");
    const intruder = await makeUser(t, "Intruder");
    const { sceneId } = await seedPlayableScene(t, owner);
    await expect(asUser(t, intruder).query(api.usage.getSceneUsage, { sceneId })).rejects.toThrow(
      /access/i,
    );
  });
});
