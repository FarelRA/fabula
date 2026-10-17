import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireScene, requireUser } from "./lib/authz";

/**
 * Anonymous → account claim (PLAN §2.1): scenes created before sign-in are
 * owned by the anonymous user; after the visitor authenticates, the app
 * claims them here. Ownership transfer only happens FROM an anonymous owner.
 */

export const claimScene = mutation({
  args: { sceneId: v.id("scenes") },
  returns: v.object({ claimed: v.boolean() }),
  handler: async (ctx, { sceneId }) => {
    const userId = await requireUser(ctx);
    const scene = await requireScene(ctx, sceneId);
    const owner = await ctx.db.get(scene.ownerId);
    if (!owner) return { claimed: false };
    if (owner.isAnonymous !== true || owner._id === userId) {
      return { claimed: false };
    }
    await ctx.db.patch(sceneId, { ownerId: userId });
    await ctx.db.patch(userId, { claimedFrom: owner._id });
    return { claimed: true };
  },
});
