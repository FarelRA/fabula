// @vitest-environment edge-runtime
import { expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { makeCard, makeT, makeUser, seedScene } from "./helpers";

/**
 * Casting agent (PLAN Phase 2.5): full cast + constraints, mid-play revisions,
 * cast regen and field regen respecting locks.
 */

test("castDraft inserts a constraint-clean cast with a human role", async () => {
  const t = makeT();
  const owner = await makeUser(t);
  const { sceneId, client } = await seedScene(t, owner);

  const result = await client.action(api.generation.casting.castDraft, {
    sceneId,
    castSize: 3,
    vibeSteer: "make the whole cast younger",
    youInScene: { name: "You", pronouns: "they/them" },
  });

  expect(result.roleIds).toHaveLength(4); // 3 AI + 1 human
  expect(result.warnings).toEqual([]); // fake generator satisfies every constraint

  const roles = await client.query(api.cast.listRoles, { sceneId, includeInactive: true });
  expect(roles.filter((role) => role.kind === "ai")).toHaveLength(3);
  expect(roles.filter((role) => role.kind === "human")).toHaveLength(1);

  // Relations resolved by name → ids (connected graph kept).
  const first = roles.find((role) => role.relations.length > 0);
  expect(first).toBeDefined();
  if (first) {
    const target = roles.find((role) => role._id === first.relations[0]?.toRoleId);
    expect(target).toBeDefined();
  }

  // Snapshot written for the casting call.
  const snapshots = await t.run(async (ctx) =>
    await ctx.db
      .query("promptSnapshots")
      .withIndex("by_scene_createdAt", (q) => q.eq("sceneId", sceneId))
      .collect(),
  );
  expect(snapshots.some((row) => row.mode === "casting")).toBe(true);
});

test("castDraft refuses to run once the scene is playing", async () => {
  const t = makeT();
  const owner = await makeUser(t);
  const { sceneId, client } = await seedScene(t, owner);
  await client.mutation(api.cast.upsertDraftRole, {
    sceneId,
    kind: "ai",
    card: makeCard("Linh"),
  });
  await client.mutation(api.beats.appendOpening, { sceneId, text: "Rain." });
  await expect(
    client.action(api.generation.casting.castDraft, { sceneId, castSize: 2 }),
  ).rejects.toThrow(/already playing/i);
});

test("fieldRegen applies unlocked fields and skips locked ones", async () => {
  const t = makeT();
  const owner = await makeUser(t);
  const { sceneId, client } = await seedScene(t, owner);
  const roleId = await client.mutation(api.cast.upsertDraftRole, {
    sceneId,
    kind: "ai",
    card: makeCard("Linh"),
  });

  // Unlocked: hook regenerates.
  const free = await client.action(api.generation.casting.fieldRegen, {
    roleId,
    fields: ["hook"],
  });
  expect(free.applied).toEqual(["hook"]);
  expect(free.changed).toBe(true);
  const after = await client.query(api.cast.getRole, { roleId });
  expect(after?.role.hook).toBe("A regenerated hook with teeth.");

  // Locked: hook is skipped entirely and the value stays byte-identical.
  await client.query(api.cast.listRoles, { sceneId }); // sanity: role exists
  await client.mutation(api.cast.setLocks, { roleId, locks: ["hook"] });
  const locked = await client.action(api.generation.casting.fieldRegen, {
    roleId,
    fields: ["hook"],
  });
  expect(locked.applied).toEqual([]);
  expect(locked.skippedLocked).toEqual(["hook"]);
  expect(locked.changed).toBe(false);
  const still = await client.query(api.cast.getRole, { roleId });
  expect(still?.role.hook).toBe("A regenerated hook with teeth."); // unchanged
});

test("castRegen rewrites unlocked fields while locks stay byte-identical", async () => {
  const t = makeT();
  const owner = await makeUser(t);
  const { sceneId, client } = await seedScene(t, owner);

  const draft = await client.action(api.generation.casting.castDraft, {
    sceneId,
    castSize: 2,
  });
  expect(draft.warnings).toEqual([]);

  const roles = await client.query(api.cast.listRoles, { sceneId });
  const first = roles[0];
  const second = roles[1];
  if (!first || !second) throw new Error("expected two roles");

  // Simulate a director edit + lock on role 0's hook.
  await client.mutation(api.cast.updateDraft, {
    roleId: first._id,
    patch: { voice: { ...first.voice, register: "custom-register" } },
  });
  await client.mutation(api.cast.setLocks, { roleId: first._id, locks: ["hook"] });

  const result = await client.action(api.generation.casting.castRegen, {
    sceneId,
    vibeSteer: "darker",
  });
  expect(result.updated).toHaveLength(2);

  const after = await client.query(api.cast.listRoles, { sceneId });
  const firstAfter = after.find((role) => role._id === first._id);
  expect(firstAfter?.hook).toBe(first.hook); // locked → byte-identical
  expect(firstAfter?.voice.register).toBe("register 0"); // unlocked → regenerated
});
