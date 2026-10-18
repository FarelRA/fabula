import { query } from "./_generated/server";
import { v } from "convex/values";
import { assertSceneAccess, requireScene } from "./lib/authz";

/**
 * Scene export: one lossless JSON bundle for
 * the archive, markdown export and `jq`. Every row keeps its Convex id so
 * parent/branch links survive a round-trip; prompt snapshots are optional
 * because they dominate the payload (`includeSnapshots`).
 *
 * Read-only by construction: the query never writes, and the pure serializers
 * live in `src/lib/export/`.
 */
export const getBundle = query({
  args: {
    sceneId: v.id("scenes"),
    includeSnapshots: v.optional(v.boolean()),
  },
  handler: async (ctx, { sceneId, includeSnapshots }) => {
    const scene = await requireScene(ctx, sceneId);
    await assertSceneAccess(ctx, scene);

    const settings = await ctx.db
      .query("sceneSettings")
      .withIndex("by_scene", (q) => q.eq("sceneId", sceneId))
      .first();
    const [roles, branches, beatsBySeq, offered, picked, dismissed] =
      await Promise.all([
        ctx.db
          .query("roles")
          .withIndex("by_scene", (q) => q.eq("sceneId", sceneId))
          .collect(),
        ctx.db
          .query("branches")
          .withIndex("by_scene", (q) => q.eq("sceneId", sceneId))
          .collect(),
        ctx.db
          .query("beats")
          .withIndex("by_scene_seq", (q) => q.eq("sceneId", sceneId))
          .collect(),
        ctx.db
          .query("candidates")
          .withIndex("by_scene_status", (q) =>
            q.eq("sceneId", sceneId).eq("status", "offered"),
          )
          .collect(),
        ctx.db
          .query("candidates")
          .withIndex("by_scene_status", (q) =>
            q.eq("sceneId", sceneId).eq("status", "picked"),
          )
          .collect(),
        ctx.db
          .query("candidates")
          .withIndex("by_scene_status", (q) =>
            q.eq("sceneId", sceneId).eq("status", "dismissed"),
          )
          .collect(),
      ]);

    const [factsActive, factsMuted, warningsOpen, warningsDismissed] =
      await Promise.all([
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
        ctx.db
          .query("continuityWarnings")
          .withIndex("by_scene_status", (q) =>
            q.eq("sceneId", sceneId).eq("status", "open"),
          )
          .collect(),
        ctx.db
          .query("continuityWarnings")
          .withIndex("by_scene_status", (q) =>
            q.eq("sceneId", sceneId).eq("status", "dismissed"),
          )
          .collect(),
      ]);

    const summaries = await ctx.db
      .query("summaries")
      .withIndex("by_scene_coveredThroughSeq", (q) => q.eq("sceneId", sceneId))
      .collect();

    const noteGroups = await Promise.all(
      (["active", "resolved", "expired"] as const).map((status) =>
        ctx.db
          .query("directorNotes")
          .withIndex("by_scene_status", (q) =>
            q.eq("sceneId", sceneId).eq("status", status),
          )
          .collect(),
      ),
    );

    const snapshots = includeSnapshots
      ? await ctx.db
          .query("promptSnapshots")
          .withIndex("by_scene_createdAt", (q) => q.eq("sceneId", sceneId))
          .collect()
      : undefined;

    return {
      format: "fabula.scene" as const,
      version: 1 as const,
      scene,
      settings,
      roles: roles.sort((a, b) => a.sortKey.localeCompare(b.sortKey)),
      branches: branches.sort((a, b) => a.createdAt - b.createdAt),
      beats: beatsBySeq.sort((a, b) => a.seq - b.seq),
      candidates: [...offered, ...picked, ...dismissed].sort(
        (a, b) => a.createdAt - b.createdAt || a.optionIndex - b.optionIndex,
      ),
      facts: [...factsActive, ...factsMuted].sort(
        (a, b) => a.createdAt - b.createdAt,
      ),
      summaries: summaries.sort((a, b) => a.coveredThroughSeq - b.coveredThroughSeq),
      warnings: [...warningsOpen, ...warningsDismissed].sort(
        (a, b) => a.createdAt - b.createdAt,
      ),
      notes: noteGroups
        .flat()
        .sort((a, b) => a.appliesFromSeq - b.appliesFromSeq),
      ...(snapshots ? { snapshots: snapshots.sort((a, b) => a.createdAt - b.createdAt) } : {}),
    };
  },
});
