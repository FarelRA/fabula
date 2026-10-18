import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { assertSceneAccess, requireScene } from "./lib/authz";
import { logAction } from "./actions";

/**
 * Continuity warnings (PLAN §6.3, §7.5; Phase 6.5 memory panel). The memory
 * agent writes them; the director can dismiss (reversible, L6). Warnings are
 * advisory only — they never block a generation.
 */

export const listForScene = query({
  args: { sceneId: v.id("scenes"), includeDismissed: v.optional(v.boolean()) },
  handler: async (ctx, { sceneId, includeDismissed }) => {
    const scene = await requireScene(ctx, sceneId);
    await assertSceneAccess(ctx, scene);
    const statuses = includeDismissed
      ? (["open", "dismissed"] as const)
      : (["open"] as const);
    const groups = await Promise.all(
      statuses.map((status) =>
        ctx.db
          .query("continuityWarnings")
          .withIndex("by_scene_status", (q) =>
            q.eq("sceneId", sceneId).eq("status", status),
          )
          .collect(),
      ),
    );
    return groups.flat().sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const dismiss = mutation({
  args: { warningId: v.id("continuityWarnings") },
  handler: async (ctx, { warningId }) => {
    const warning = await ctx.db.get(warningId);
    if (!warning) throw new Error("Warning not found");
    const scene = await requireScene(ctx, warning.sceneId);
    const userId = await assertSceneAccess(ctx, scene, { write: true });
    await ctx.db.patch(warningId, { status: "dismissed" });
    await logAction(ctx, {
      sceneId: scene._id,
      type: "warning.dismiss",
      payload: { warningId },
      inverse: {
        kind: "patchWarning",
        warningId,
        patch: { status: warning.status },
      },
      userId,
    });
  },
});
