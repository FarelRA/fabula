import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { assertSceneAccess, requireScene } from "./lib/authz";
import { randomToken } from "./lib/ids";
import { nowMs } from "./lib/time";
import { projectPath } from "./lib/path";

/**
 * Share links (PLAN §7 Phase 7, Phase 1.6): tokenized read access.
 * Viewers are read-only by construction — mutations are identity-guarded
 * (assertSceneAccess) and never accept a share token.
 */

export const create = mutation({
  args: {
    sceneId: v.id("scenes"),
    permission: v.union(v.literal("viewer"), v.literal("director")),
    expiresAt: v.optional(v.number()),
  },
  returns: v.object({ shareId: v.id("shareLinks"), token: v.string() }),
  handler: async (ctx, args) => {
    const scene = await requireScene(ctx, args.sceneId);
    const userId = await assertSceneAccess(ctx, scene, { write: true });
    const token = randomToken(16);
    const shareId = await ctx.db.insert("shareLinks", {
      sceneId: scene._id,
      token,
      permission: args.permission,
      createdByUserId: userId,
      expiresAt: args.expiresAt,
    });
    return { shareId, token };
  },
});

export const revoke = mutation({
  args: { shareId: v.id("shareLinks") },
  handler: async (ctx, { shareId }) => {
    const share = await ctx.db.get(shareId);
    if (!share) throw new Error("Share link not found");
    const scene = await requireScene(ctx, share.sceneId);
    await assertSceneAccess(ctx, scene, { write: true });
    await ctx.db.patch(shareId, { revokedAt: nowMs() });
  },
});

export const listForScene = query({
  args: { sceneId: v.id("scenes") },
  handler: async (ctx, { sceneId }) => {
    const scene = await requireScene(ctx, sceneId);
    await assertSceneAccess(ctx, scene);
    const rows = await ctx.db
      .query("shareLinks")
      .withIndex("by_scene", (q) => q.eq("sceneId", sceneId))
      .collect();
    return rows.sort((a, b) => (b._creationTime ?? 0) - (a._creationTime ?? 0));
  },
});

export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const share = await ctx.db
      .query("shareLinks")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    if (!share) return null;
    if (share.revokedAt !== undefined) return null;
    if (share.expiresAt !== undefined && share.expiresAt < Date.now()) return null;
    const scene = await ctx.db.get(share.sceneId);
    if (!scene) return null;
    const settings = await ctx.db
      .query("sceneSettings")
      .withIndex("by_scene", (q) => q.eq("sceneId", scene._id))
      .first();
    const roles = await ctx.db
      .query("roles")
      .withIndex("by_scene", (q) => q.eq("sceneId", scene._id))
      .collect();
    const projection = await projectPath(ctx, scene);
    return {
      permission: share.permission,
      scene,
      settings,
      roles: roles
        .filter((role) => role.status === "active")
        .sort((a, b) => a.sortKey.localeCompare(b.sortKey)),
      beats: projection.chain,
      facts: projection.facts,
      summaries: projection.summaries,
    };
  },
});
