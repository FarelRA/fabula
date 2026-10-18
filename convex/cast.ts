import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { assertSceneAccess, assertSceneMutable, requireScene } from "./lib/authz";
import { sortKeyFor } from "./lib/ids";
import { nowMs } from "./lib/time";
import { roleCardV, tierV, roleStatusV } from "./lib/validators";
import { logAction } from "./actions";

/**
 * Cast + role revisions (PLAN §3.1, Phase 1.2).
 *
 * Draft semantics: before the scene is playable (no opener beat), role edits
 * mutate the role row directly — there is no history worth preserving yet.
 * Once play starts, every change goes through `reviseRole`, which appends a
 * `roleRevisions` row with `effectiveFromBeatId` so future generations use
 * the new card while past beats keep compiling against the old one.
 */

function cardFromRole(role: Doc<"roles">) {
  return {
    identity: {
      name: role.identity.name,
      monogram: role.identity.monogram,
      ageEra: role.identity.ageEra,
      pronouns: role.identity.pronouns,
      occupation: role.identity.occupation,
      accentColor: role.identity.accentColor,
      avatarPrompt: role.identity.avatarPrompt,
    },
    hook: role.hook,
    psychology: role.psychology,
    voice: role.voice,
    drives: role.drives,
    boundariesLines: role.boundariesLines,
    relations: role.relations,
    meta: role.meta,
  };
}

const roleCardPatchV = v.object({
  identity: v.optional(roleCardV.fields.identity),
  hook: v.optional(roleCardV.fields.hook),
  psychology: v.optional(roleCardV.fields.psychology),
  voice: v.optional(roleCardV.fields.voice),
  drives: v.optional(roleCardV.fields.drives),
  boundariesLines: v.optional(roleCardV.fields.boundariesLines),
  relations: v.optional(roleCardV.fields.relations),
  meta: v.optional(roleCardV.fields.meta),
});

async function requireRole(ctx: MutationCtx, roleId: Id<"roles">): Promise<Doc<"roles">> {
  const role = await ctx.db.get(roleId);
  if (!role) throw new Error("Role not found");
  return role;
}

export const listRoles = query({
  args: { sceneId: v.id("scenes"), includeInactive: v.optional(v.boolean()) },
  handler: async (ctx, { sceneId, includeInactive }) => {
    const scene = await requireScene(ctx, sceneId);
    await assertSceneAccess(ctx, scene);
    const roles = await ctx.db
      .query("roles")
      .withIndex("by_scene", (q) => q.eq("sceneId", sceneId))
      .collect();
    const filtered = includeInactive ? roles : roles.filter((role) => role.status === "active");
    return filtered.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  },
});

export const getRole = query({
  args: { roleId: v.id("roles") },
  handler: async (ctx, { roleId }) => {
    const role = await ctx.db.get(roleId);
    if (!role) return null;
    const scene = await requireScene(ctx, role.sceneId);
    await assertSceneAccess(ctx, scene);
    const revisions = await ctx.db
      .query("roleRevisions")
      .withIndex("by_role_effectiveSeq", (q) => q.eq("roleId", roleId))
      .order("desc")
      .collect();
    return { role, revisions };
  },
});

export const upsertDraftRole = mutation({
  args: {
    sceneId: v.id("scenes"),
    kind: v.union(v.literal("ai"), v.literal("human")),
    userId: v.optional(v.id("users")),
    card: roleCardV,
  },
  returns: v.id("roles"),
  handler: async (ctx, args) => {
    const scene = await requireScene(ctx, args.sceneId);
    await assertSceneAccess(ctx, scene, { write: true });
    assertSceneMutable(scene);
    const existing = await ctx.db
      .query("roles")
      .withIndex("by_scene", (q) => q.eq("sceneId", args.sceneId))
      .collect();
    const roleId = await ctx.db.insert("roles", {
      sceneId: args.sceneId,
      kind: args.kind,
      userId: args.userId,
      identity: args.card.identity,
      hook: args.card.hook,
      psychology: args.card.psychology,
      voice: args.card.voice,
      drives: args.card.drives,
      boundariesLines: args.card.boundariesLines,
      relations: args.card.relations,
      meta: args.card.meta,
      status: "active",
      statusChangedAtSeq: 0,
      sortKey: sortKeyFor(existing.length),
      draftLocks: [],
    });
    if (scene.activeTipBeatId !== undefined) {
      // Mid-story casting (PLAN §2.3): the new role starts speaking from the
      // current tip — insert its initial revision so future generations at
      // this position compile with a versioned card.
      const revisionId = await ctx.db.insert("roleRevisions", {
        roleId,
        sceneId: args.sceneId,
        effectiveFromBeatId: scene.activeTipBeatId,
        effectiveSeq: scene.seqCounter,
        card: args.card,
        changedFields: ["initial"],
        origin: "initial",
        createdAt: nowMs(),
      });
      await ctx.db.patch(roleId, { currentRevisionId: revisionId });
    }
    return roleId;
  },
});

export const updateDraft = mutation({
  args: { roleId: v.id("roles"), patch: roleCardPatchV },
  handler: async (ctx, { roleId, patch }) => {
    const role = await requireRole(ctx, roleId);
    const scene = await requireScene(ctx, role.sceneId);
    await assertSceneAccess(ctx, scene, { write: true });
    assertSceneMutable(scene);
    if (scene.activeTipBeatId !== undefined) {
      throw new Error("Scene is already playing; use reviseRole for versioned changes");
    }
    const next: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) next[key] = value;
    }
    if (patch.identity !== undefined) {
      next.identity = { ...role.identity, ...patch.identity };
    }
    await ctx.db.patch(roleId, next);
  },
});

export const reviseRole = mutation({
  args: {
    roleId: v.id("roles"),
    effectiveFromBeatId: v.id("beats"),
    patch: roleCardPatchV,
    origin: v.optional(
      v.union(v.literal("edit"), v.literal("regen"), v.literal("vibeSteer")),
    ),
  },
  returns: v.id("roleRevisions"),
  handler: async (ctx, args) => {
    const role = await requireRole(ctx, args.roleId);
    const scene = await requireScene(ctx, role.sceneId);
    await assertSceneAccess(ctx, scene, { write: true });
    assertSceneMutable(scene);
    const beat = await ctx.db.get(args.effectiveFromBeatId);
    if (!beat || beat.sceneId !== scene._id) {
      throw new Error("effectiveFromBeatId must be a beat of this scene");
    }
    const changedFields = Object.entries(args.patch)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key);

    const nextRole: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(args.patch)) {
      if (value !== undefined) nextRole[key] = value;
    }

    const mergedIdentity = { ...role.identity, ...(args.patch.identity ?? {}) };
    const card = {
      ...cardFromRole(role),
      ...nextRole,
      identity: mergedIdentity,
    };

    const revisionId = await ctx.db.insert("roleRevisions", {
      roleId: role._id,
      sceneId: scene._id,
      effectiveFromBeatId: beat._id,
      effectiveSeq: beat.seq,
      card,
      changedFields,
      origin: args.origin ?? "edit",
      createdAt: nowMs(),
    });

    await ctx.db.patch(role._id, {
      ...nextRole,
      identity: mergedIdentity,
      currentRevisionId: revisionId,
    });
    return revisionId;
  },
});

export const setStatus = mutation({
  args: { roleId: v.id("roles"), status: roleStatusV },
  handler: async (ctx, { roleId, status }) => {
    const role = await requireRole(ctx, roleId);
    const scene = await requireScene(ctx, role.sceneId);
    const userId = await assertSceneAccess(ctx, scene, { write: true });
    assertSceneMutable(scene);
    await ctx.db.patch(roleId, { status, statusChangedAtSeq: scene.seqCounter });
    await logAction(ctx, {
      sceneId: scene._id,
      type: `role.${status}`,
      payload: { roleId, previousStatus: role.status },
      inverse: { kind: "patchRole", roleId, patch: { status: role.status } },
      userId,
    });
  },
});

export const setTier = mutation({
  args: { roleId: v.id("roles"), tier: tierV },
  handler: async (ctx, { roleId, tier }) => {
    const role = await requireRole(ctx, roleId);
    const scene = await requireScene(ctx, role.sceneId);
    const userId = await assertSceneAccess(ctx, scene, { write: true });
    assertSceneMutable(scene);
    const previousMeta = role.meta;
    await ctx.db.patch(roleId, { meta: { ...role.meta, tier } });
    await logAction(ctx, {
      sceneId: scene._id,
      type: "role.setTier",
      payload: { roleId, tier },
      inverse: { kind: "patchRole", roleId, patch: { meta: previousMeta } },
      userId,
    });
  },
});

export const reorder = mutation({
  args: { sceneId: v.id("scenes"), roleIds: v.array(v.id("roles")) },
  handler: async (ctx, { sceneId, roleIds }) => {
    const scene = await requireScene(ctx, sceneId);
    const userId = await assertSceneAccess(ctx, scene, { write: true });
    assertSceneMutable(scene);
    const previous: Array<{ roleId: Id<"roles">; sortKey: string }> = [];
    for (let i = 0; i < roleIds.length; i += 1) {
      const roleId = roleIds[i];
      if (!roleId) continue;
      const role = await requireRole(ctx, roleId);
      if (role.sceneId !== sceneId) throw new Error("Role belongs to another scene");
      previous.push({ roleId, sortKey: role.sortKey });
      await ctx.db.patch(roleId, { sortKey: sortKeyFor(i) });
    }
    await logAction(ctx, {
      sceneId,
      type: "role.reorder",
      payload: { roleIds },
      inverse: { kind: "patchRoleOrder", entries: previous },
      userId,
    });
  },
});

export const setLocks = mutation({
  args: { roleId: v.id("roles"), locks: v.array(v.string()) },
  handler: async (ctx, { roleId, locks }) => {
    const role = await requireRole(ctx, roleId);
    const scene = await requireScene(ctx, role.sceneId);
    await assertSceneAccess(ctx, scene, { write: true });
    assertSceneMutable(scene);
    await ctx.db.patch(roleId, { draftLocks: locks });
  },
});

/**
 * Called when a scene becomes playable (opening beat appended): freeze each
 * active role's current card as its initial revision (PLAN §3.1 versioning).
 */
export async function ensureInitialRevisions(
  ctx: MutationCtx,
  scene: Doc<"scenes">,
  openerBeatId: Id<"beats">,
  openerSeq: number,
): Promise<void> {
  const roles = await ctx.db
    .query("roles")
    .withIndex("by_scene", (q) => q.eq("sceneId", scene._id))
    .collect();
  for (const role of roles) {
    if (role.currentRevisionId) continue;
    const revisionId = await ctx.db.insert("roleRevisions", {
      roleId: role._id,
      sceneId: scene._id,
      effectiveFromBeatId: openerBeatId,
      effectiveSeq: openerSeq,
      card: cardFromRole(role),
      changedFields: ["initial"],
      origin: "initial",
      createdAt: nowMs(),
    });
    await ctx.db.patch(role._id, { currentRevisionId: revisionId });
  }
}
