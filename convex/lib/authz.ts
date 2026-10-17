import type { ActionCtx, QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

export type Ctx = QueryCtx | MutationCtx;
export type AnyCtx = QueryCtx | MutationCtx | ActionCtx;

/**
 * Resolve the current user id from the auth identity.
 *
 * Convex Auth issues token identifiers of the form `<issuer>|<userId>`; we
 * take the suffix and fall back to `subject`. This keeps domain code free of
 * auth-library imports (tests simulate identities directly).
 */
export async function currentUserId(ctx: AnyCtx): Promise<Id<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const fromToken = identity.tokenIdentifier.split("|").pop();
  const raw = fromToken && fromToken.length > 0 ? fromToken : identity.subject;
  if (!raw || raw.length === 0) return null;
  return raw as Id<"users">;
}

export async function requireUser(ctx: AnyCtx): Promise<Id<"users">> {
  const userId = await currentUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

/**
 * Access control for a scene:
 *  - owner: full access
 *  - participant (human seated later): full access
 *  - everyone else: no access (share links are read-only and handled
 *    separately by shares.getByToken)
 */
export async function assertSceneAccess(
  ctx: Ctx,
  scene: Doc<"scenes">,
  options: { write?: boolean } = {},
): Promise<Id<"users">> {
  const userId = await currentUserId(ctx);
  if (userId) {
    if (scene.ownerId === userId) return userId;
    const participant = await ctx.db
      .query("participants")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("sceneId"), scene._id))
      .first();
    if (participant) return userId;
  }
  const mode = options.write ? "write" : "read";
  throw new Error(`No ${mode} access to this scene`);
}

export async function requireScene(
  ctx: Ctx,
  sceneId: Id<"scenes">,
): Promise<Doc<"scenes">> {
  const scene = await ctx.db.get(sceneId);
  if (!scene) throw new Error("Scene not found");
  return scene;
}
