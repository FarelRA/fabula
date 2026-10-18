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
  // Convex Auth issues `sub = <userId>|<sessionId>`; Convex prefixes that with
  // the issuer in `tokenIdentifier`. Prefer the first subject segment so we
  // land on `users`, not `authSessions` (test identities use a bare subject).
  const subject = identity.subject;
  const raw = (subject.includes("|") ? subject.split("|")[0] : subject)
    ?? identity.tokenIdentifier.split("|").pop();
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

/**
 * Story immutability (PLAN §8.4, Phase 7.1): once a scene is archived its
 * tree, cast, memory and notes are frozen. Scene-level operations (sharing,
 * export, the undo log) stay available; `actions.undoLast` remains the
 * explicit reversibility path for a wrap.
 */
export function assertSceneMutable(scene: Doc<"scenes">): void {
  if (scene.status === "archived") {
    throw new Error("This scene is archived — the story is frozen. Undo the wrap to keep playing.");
  }
}

/**
 * Share-link credential check (PLAN §8.7, Phase 7.4). A valid token is the
 * only credential a viewer/director needs — no identity required. Director
 * links additionally authorize the pick mutation; everything else with a
 * token is read-only by construction.
 */
export async function assertShareLink(
  ctx: Ctx,
  token: string,
  scene: Doc<"scenes">,
  options: { permission?: "viewer" | "director" } = {},
): Promise<Doc<"shareLinks">> {
  const share = await ctx.db
    .query("shareLinks")
    .withIndex("by_token", (q) => q.eq("token", token))
    .first();
  if (!share || share.sceneId !== scene._id) {
    throw new Error("This share link is not valid for this scene");
  }
  if (share.revokedAt !== undefined) throw new Error("This share link was revoked");
  if (share.expiresAt !== undefined && share.expiresAt < Date.now()) {
    throw new Error("This share link expired");
  }
  if (options.permission === "director" && share.permission !== "director") {
    throw new Error("This share link is view-only");
  }
  return share;
}
