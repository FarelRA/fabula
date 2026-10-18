import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { assertSceneAccess, requireScene } from "./lib/authz";
import { nowMs } from "./lib/time";
import { logAction } from "./actions";
import { projectPath } from "./lib/path";

/**
 * Facts ledger (PLAN §3.4, §6.3, Phase 1.4): append-only canon rows tied to
 * the beat where they were introduced. The active path filters them; pinned
 * facts are explicit scene-global overrides (ADR-001).
 */

export const add = mutation({
  args: {
    sceneId: v.id("scenes"),
    nodeId: v.id("beats"),
    text: v.string(),
    subjects: v.optional(v.array(v.id("roles"))),
    visibilityKind: v.optional(v.union(v.literal("public"), v.literal("private"))),
    visibilityRoleIds: v.optional(v.array(v.id("roles"))),
  },
  returns: v.id("facts"),
  handler: async (ctx, args) => {
    const scene = await requireScene(ctx, args.sceneId);
    await assertSceneAccess(ctx, scene, { write: true });
    const beat = await ctx.db.get(args.nodeId);
    if (!beat || beat.sceneId !== args.sceneId) {
      throw new Error("Fact nodeId must be a beat of this scene");
    }
    return await ctx.db.insert("facts", {
      sceneId: args.sceneId,
      nodeId: args.nodeId,
      text: args.text,
      subjects: args.subjects ?? [],
      visibility: {
        kind: args.visibilityKind ?? "public",
        roleIds: args.visibilityRoleIds ?? [],
      },
      status: "active",
      isPinned: false,
      source: "user",
      createdAt: nowMs(),
    });
  },
});

export const setPinned = mutation({
  args: { factId: v.id("facts"), pinned: v.boolean() },
  handler: async (ctx, { factId, pinned }) => {
    const fact = await ctx.db.get(factId);
    if (!fact) throw new Error("Fact not found");
    const scene = await requireScene(ctx, fact.sceneId);
    const userId = await assertSceneAccess(ctx, scene, { write: true });
    await ctx.db.patch(factId, { isPinned: pinned });
    await logAction(ctx, {
      sceneId: scene._id,
      type: pinned ? "fact.pin" : "fact.unpin",
      payload: { factId },
      inverse: { kind: "patchFact", factId, patch: { isPinned: fact.isPinned } },
      userId,
    });
  },
});

export const setStatus = mutation({
  args: { factId: v.id("facts"), status: v.union(v.literal("active"), v.literal("muted")) },
  handler: async (ctx, { factId, status }) => {
    const fact = await ctx.db.get(factId);
    if (!fact) throw new Error("Fact not found");
    const scene = await requireScene(ctx, fact.sceneId);
    const userId = await assertSceneAccess(ctx, scene, { write: true });
    await ctx.db.patch(factId, { status });
    await logAction(ctx, {
      sceneId: scene._id,
      type: `fact.${status}`,
      payload: { factId },
      inverse: { kind: "patchFact", factId, patch: { status: fact.status } },
      userId,
    });
  },
});

export const listForPath = query({
  args: { sceneId: v.id("scenes") },
  handler: async (ctx, { sceneId }) => {
    const scene = await requireScene(ctx, sceneId);
    await assertSceneAccess(ctx, scene);
    const projection = await projectPath(ctx, scene);
    return projection.facts.sort((a, b) => a.createdAt - b.createdAt);
  },
});

/**
 * Whole-ledger read for the memory panel (PLAN §6.3, Phase 6.5). Unlike
 * `listForPath`, this includes muted and off-path facts so the director can
 * mute/unmute, pin, and see exactly what the active path excludes.
 */
export const listForScene = query({
  args: { sceneId: v.id("scenes") },
  handler: async (ctx, { sceneId }) => {
    const scene = await requireScene(ctx, sceneId);
    await assertSceneAccess(ctx, scene);
    const projection = await projectPath(ctx, scene);
    const pathIds = new Set(projection.chain.map((beat) => beat._id));
    const [active, muted] = await Promise.all([
      ctx.db
        .query("facts")
        .withIndex("by_scene_status", (q) =>
          q.eq("sceneId", sceneId).eq("status", "active"),
        )
        .collect(),
      ctx.db
        .query("facts")
        .withIndex("by_scene_status", (q) =>
          q.eq("sceneId", sceneId).eq("status", "muted"),
        )
        .collect(),
    ]);
    return [...active, ...muted]
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((fact) => ({
        ...fact,
        onPath: pathIds.has(fact.nodeId),
        inContext: pathIds.has(fact.nodeId) || fact.isPinned,
      }));
  },
});

/**
 * Memory-agent writes (PLAN §3.4): extracted facts arrive pre-deduped from
 * the action; nodeIds are already validated against the window.
 */
export const insertExtracted = internalMutation({
  args: {
    sceneId: v.id("scenes"),
    facts: v.array(
      v.object({
        text: v.string(),
        subjects: v.array(v.id("roles")),
        visibilityKind: v.union(v.literal("public"), v.literal("private")),
        visibilityRoleIds: v.array(v.id("roles")),
        nodeId: v.id("beats"),
      }),
    ),
  },
  returns: v.array(v.id("facts")),
  handler: async (ctx, args) => {
    const ids: Id<"facts">[] = [];
    for (const fact of args.facts) {
      ids.push(
        await ctx.db.insert("facts", {
          sceneId: args.sceneId,
          nodeId: fact.nodeId,
          text: fact.text,
          subjects: fact.subjects,
          visibility: { kind: fact.visibilityKind, roleIds: fact.visibilityRoleIds },
          status: "active",
          isPinned: false,
          source: "memory",
          createdAt: nowMs(),
        }),
      );
    }
    return ids;
  },
});
