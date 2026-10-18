import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { components } from "./_generated/api";
import { Presence } from "@convex-dev/presence";

/**
 * Presence for shared scenes (PLAN §3.1, §9.10, Phase 7.4): the room id is the
 * share token itself, so the token is the only credential — the wrappers
 * validate it against `shareLinks` (not revoked, not expired) before touching
 * the presence component. Identity-based rooms can be added later without
 * changing the shape.
 */

const presence = new Presence(components.presence);

async function assertRoomToken(
  ctx: QueryCtx | MutationCtx,
  roomToken: string,
): Promise<void> {
  const share = await ctx.db
    .query("shareLinks")
    .withIndex("by_token", (q) => q.eq("token", roomToken))
    .first();
  if (!share) throw new Error("Unknown share room");
  if (share.revokedAt !== undefined) throw new Error("This share link was revoked");
  if (share.expiresAt !== undefined && share.expiresAt < Date.now()) {
    throw new Error("This share link expired");
  }
}

export const heartbeat = mutation({
  args: {
    roomId: v.string(),
    userId: v.string(),
    sessionId: v.string(),
    interval: v.number(),
  },
  handler: async (ctx, args) => {
    await assertRoomToken(ctx, args.roomId);
    return await presence.heartbeat(
      ctx,
      args.roomId,
      args.userId,
      args.sessionId,
      args.interval,
    );
  },
});

export const list = query({
  args: { roomToken: v.string() },
  handler: async (ctx, { roomToken }) => {
    // `roomToken` is the component's opaque room credential returned by
    // heartbeat — it is not the share link. Room access is gated at
    // heartbeat time (only valid share tokens can open a session).
    return await presence.list(ctx, roomToken);
  },
});

export const disconnect = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    // Called over sendBeacon on unload: no auth available, and the opaque
    // session token is the only credential the component needs.
    return await presence.disconnect(ctx, sessionToken);
  },
});
