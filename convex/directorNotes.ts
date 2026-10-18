import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { assertSceneAccess, assertSceneMutable, requireScene } from "./lib/authz";
import { nowMs } from "./lib/time";
import { logAction } from "./actions";

/**
 * Director notes, steering, standing constraints, do-not list.
 * Active notes feed the compiler's director block (block 7, never shrunk).
 */

export const add = mutation({
  args: {
    sceneId: v.id("scenes"),
    kind: v.union(v.literal("steer"), v.literal("constraint"), v.literal("doNot")),
    text: v.string(),
  },
  returns: v.id("directorNotes"),
  handler: async (ctx, args) => {
    const scene = await requireScene(ctx, args.sceneId);
    const userId = await assertSceneAccess(ctx, scene, { write: true });
    assertSceneMutable(scene);
    const noteId = await ctx.db.insert("directorNotes", {
      sceneId: scene._id,
      kind: args.kind,
      text: args.text,
      appliesFromSeq: scene.seqCounter + 1,
      status: "active",
      createdByUserId: userId,
      createdAt: nowMs(),
    });
    await logAction(ctx, {
      sceneId: scene._id,
      type: `note.${args.kind}`,
      payload: { noteId, text: args.text },
      inverse: { kind: "patchNote", noteId, patch: { status: "resolved" } },
      userId,
    });
    return noteId;
  },
});

export const resolve = mutation({
  args: { noteId: v.id("directorNotes") },
  handler: async (ctx, { noteId }) => {
    const note = await ctx.db.get(noteId);
    if (!note) throw new Error("Note not found");
    const scene = await requireScene(ctx, note.sceneId);
    const userId = await assertSceneAccess(ctx, scene, { write: true });
    assertSceneMutable(scene);
    await ctx.db.patch(noteId, { status: "resolved" });
    await logAction(ctx, {
      sceneId: scene._id,
      type: "note.resolve",
      payload: { noteId },
      inverse: { kind: "patchNote", noteId, patch: { status: note.status } },
      userId,
    });
  },
});

export const listActive = query({
  args: { sceneId: v.id("scenes") },
  handler: async (ctx, { sceneId }) => {
    const scene = await requireScene(ctx, sceneId);
    await assertSceneAccess(ctx, scene);
    const rows = await ctx.db
      .query("directorNotes")
      .withIndex("by_scene_status", (q) => q.eq("sceneId", sceneId).eq("status", "active"))
      .collect();
    return rows.sort((a, b) => a.appliesFromSeq - b.appliesFromSeq);
  },
});
