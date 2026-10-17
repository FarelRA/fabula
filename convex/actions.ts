import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { assertSceneAccess, requireScene } from "./lib/authz";
import { nowMs } from "./lib/time";

/**
 * Action log + undo (PLAN §8.4 "Undo", law L6: nothing is ever destroyed;
 * everything is reversible). Every reversible director action logs an inverse
 * op; `undoLast` applies the newest unconsumed inverse inside a transaction.
 */

export type InverseAction =
  | {
      kind: "restoreActive";
      branchId?: Id<"branches">;
      tipBeatId?: Id<"beats">;
      candidateId?: Id<"candidates">;
    }
  | { kind: "patchRole"; roleId: Id<"roles">; patch: Record<string, unknown> }
  | { kind: "patchFact"; factId: Id<"facts">; patch: Record<string, unknown> }
  | { kind: "patchBeat"; beatId: Id<"beats">; patch: Record<string, unknown> }
  | { kind: "patchBranch"; branchId: Id<"branches">; patch: Record<string, unknown> }
  | { kind: "patchNote"; noteId: Id<"directorNotes">; patch: Record<string, unknown> }
  | { kind: "patchCandidate"; candidateId: Id<"candidates">; patch: Record<string, unknown> }
  | { kind: "patchRoleOrder"; entries: Array<{ roleId: Id<"roles">; sortKey: string }> };

export async function logAction(
  ctx: MutationCtx,
  args: {
    sceneId: Id<"scenes">;
    type: string;
    payload: unknown;
    inverse: InverseAction;
    userId: Id<"users">;
  },
): Promise<void> {
  const last = await ctx.db
    .query("actions")
    .withIndex("by_scene_seq", (q) => q.eq("sceneId", args.sceneId))
    .order("desc")
    .first();
  await ctx.db.insert("actions", {
    sceneId: args.sceneId,
    seq: (last?.seq ?? 0) + 1,
    type: args.type,
    payload: args.payload,
    inverse: args.inverse,
    createdByUserId: args.userId,
    createdAt: nowMs(),
  });
}

async function applyInverse(
  ctx: MutationCtx,
  sceneId: Id<"scenes">,
  inverse: InverseAction,
): Promise<void> {
  switch (inverse.kind) {
    case "restoreActive": {
      await ctx.db.patch(sceneId, {
        activeBranchId: inverse.branchId,
        activeTipBeatId: inverse.tipBeatId,
      });
      if (inverse.candidateId) {
        await ctx.db.patch(inverse.candidateId, {
          status: "offered",
          pickedBeatId: undefined,
        });
      }
      return;
    }
    case "patchRole": {
      await ctx.db.patch(inverse.roleId, inverse.patch as Partial<Doc<"roles">>);
      return;
    }
    case "patchFact": {
      await ctx.db.patch(inverse.factId, inverse.patch as Partial<Doc<"facts">>);
      return;
    }
    case "patchBeat": {
      await ctx.db.patch(inverse.beatId, inverse.patch as Partial<Doc<"beats">>);
      return;
    }
    case "patchBranch": {
      await ctx.db.patch(inverse.branchId, inverse.patch as Partial<Doc<"branches">>);
      return;
    }
    case "patchNote": {
      await ctx.db.patch(inverse.noteId, inverse.patch as Partial<Doc<"directorNotes">>);
      return;
    }
    case "patchCandidate": {
      await ctx.db.patch(inverse.candidateId, inverse.patch as Partial<Doc<"candidates">>);
      return;
    }
    case "patchRoleOrder": {
      for (const entry of inverse.entries) {
        await ctx.db.patch(entry.roleId, { sortKey: entry.sortKey });
      }
      return;
    }
  }
}

export const undoLast = mutation({
  args: { sceneId: v.id("scenes") },
  returns: v.object({ undone: v.boolean(), type: v.union(v.string(), v.null()) }),
  handler: async (ctx, { sceneId }) => {
    const scene = await requireScene(ctx, sceneId);
    await assertSceneAccess(ctx, scene, { write: true });
    const recent = await ctx.db
      .query("actions")
      .withIndex("by_scene_seq", (q) => q.eq("sceneId", sceneId))
      .order("desc")
      .collect();
    const action = recent.find((row) => row.undoneAt === undefined);
    if (!action) return { undone: false, type: null };
    await applyInverse(ctx, sceneId, action.inverse as InverseAction);
    await ctx.db.patch(action._id, { undoneAt: nowMs() });
    return { undone: true, type: action.type };
  },
});

export const list = query({
  args: { sceneId: v.id("scenes"), limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      _id: v.id("actions"),
      seq: v.number(),
      type: v.string(),
      createdAt: v.number(),
      undoneAt: v.union(v.number(), v.null()),
    }),
  ),
  handler: async (ctx, { sceneId, limit }) => {
    const scene = await requireScene(ctx, sceneId);
    await assertSceneAccess(ctx, scene);
    const rows = await ctx.db
      .query("actions")
      .withIndex("by_scene_seq", (q) => q.eq("sceneId", sceneId))
      .order("desc")
      .take(limit ?? 20);
    return rows.map((row) => ({
      _id: row._id,
      seq: row.seq,
      type: row.type,
      createdAt: row.createdAt,
      undoneAt: row.undoneAt ?? null,
    }));
  },
});
