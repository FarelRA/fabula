import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  assertSceneAccess,
  assertSceneMutable,
  currentUserId,
  requireScene,
  requireUser,
} from "./lib/authz";
import { logAction } from "./actions";
import { nowMs } from "./lib/time";
import { settingsV } from "./lib/validators";

/**
 * Scenes + settings (PLAN §5, Phase 1.1).
 * Creating a scene also creates its mainline branch; the active tip stays
 * undefined until the opening beat exists.
 */

export const create = mutation({
  args: {
    title: v.string(),
    premise: v.string(),
    settings: settingsV,
  },
  returns: v.object({ sceneId: v.id("scenes"), branchId: v.id("branches") }),
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const sceneId = await ctx.db.insert("scenes", {
      ownerId: userId,
      title: args.title,
      status: "draft",
      premise: args.premise,
      seqCounter: 0,
    });
    const branchId = await ctx.db.insert("branches", {
      sceneId,
      label: "Main",
      createdByUserId: userId,
      colorIndex: 0,
      createdAt: nowMs(),
    });
    await ctx.db.patch(sceneId, { activeBranchId: branchId });
    await ctx.db.insert("sceneSettings", { sceneId, ...args.settings });
    return { sceneId, branchId };
  },
});

export const get = query({
  args: { sceneId: v.id("scenes") },
  handler: async (ctx, { sceneId }) => {
    const scene = await requireScene(ctx, sceneId);
    await assertSceneAccess(ctx, scene);
    const settings = await ctx.db
      .query("sceneSettings")
      .withIndex("by_scene", (q) => q.eq("sceneId", sceneId))
      .first();
    return { scene, settings };
  },
});

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await currentUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("scenes")
      .withIndex("by_owner_updated", (q) => q.eq("ownerId", userId))
      .order("desc")
      .collect();
  },
});

const settingsPatchV = v.object({
  genre: v.optional(v.string()),
  settingEra: v.optional(v.string()),
  presentationStyle: v.optional(v.union(v.literal("chat"), v.literal("script"), v.literal("novel"))),
  playLanguage: v.optional(v.string()),
  tone: v.optional(
    v.object({
      comedicGrim: v.number(),
      groundedFantastical: v.number(),
      romanceRivalry: v.number(),
    }),
  ),
  boundaries: v.optional(v.object({ allowed: v.array(v.string()), blocked: v.array(v.string()) })),
  turnRules: v.optional(
    v.object({
      mode: v.union(
        v.literal("roundRobin"),
        v.literal("reactive"),
        v.literal("directorLed"),
        v.literal("freeform"),
      ),
      autoBurst: v.boolean(),
      burstMax: v.number(),
      abortedKeepsPartial: v.boolean(),
    }),
  ),
  branchFrequency: v.optional(v.union(v.literal("always"), v.literal("key"), v.literal("onDemand"))),
  optionsDefaultCount: v.optional(v.number()),
  contextBeatsK: v.optional(v.number()),
  summaryEveryN: v.optional(v.number()),
  lengthTarget: v.optional(v.union(v.literal("short"), v.literal("medium"), v.literal("long"))),
  budget: v.optional(v.object({ softUsdCap: v.optional(v.number()) })),
});

export const updateSettings = mutation({
  args: { sceneId: v.id("scenes"), patch: settingsPatchV },
  handler: async (ctx, { sceneId, patch }) => {
    const scene = await requireScene(ctx, sceneId);
    await assertSceneAccess(ctx, scene, { write: true });
    assertSceneMutable(scene);
    const settings = await ctx.db
      .query("sceneSettings")
      .withIndex("by_scene", (q) => q.eq("sceneId", sceneId))
      .first();
    if (!settings) throw new Error("Scene settings not found");
    const next: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) next[key] = value;
    }
    await ctx.db.patch(settings._id, next);
  },
});

export const rename = mutation({
  args: { sceneId: v.id("scenes"), title: v.string() },
  handler: async (ctx, { sceneId, title }) => {
    const scene = await requireScene(ctx, sceneId);
    await assertSceneAccess(ctx, scene, { write: true });
    assertSceneMutable(scene);
    await ctx.db.patch(sceneId, { title });
  },
});

export const setStatus = mutation({
  args: {
    sceneId: v.id("scenes"),
    status: v.union(
      v.literal("draft"),
      v.literal("playing"),
      v.literal("paused"),
      v.literal("archived"),
    ),
  },
  handler: async (ctx, { sceneId, status }) => {
    const scene = await requireScene(ctx, sceneId);
    await assertSceneAccess(ctx, scene, { write: true });
    if (scene.status === "archived" && status !== "archived") {
      assertSceneMutable(scene); // throws: the wrap is only reversible via undo
    }
    await ctx.db.patch(sceneId, {
      status,
      endedAt: status === "archived" ? nowMs() : scene.endedAt,
    });
  },
});

/**
 * Wrap & archive (PLAN §8.4/§8.6, Phase 7.1): freezes the tree, stamps
 * `endedAt`, kicks off the final summary pass for any uncovered tail and logs
 * a reversible `patchScene` inverse — so ⌘Z reopens the scene (L6) while
 * every story mutation is blocked until then.
 */
export const endScene = mutation({
  args: { sceneId: v.id("scenes") },
  returns: v.object({ archived: v.boolean(), summaryScheduled: v.boolean() }),
  handler: async (ctx, { sceneId }) => {
    const scene = await requireScene(ctx, sceneId);
    const userId = await assertSceneAccess(ctx, scene, { write: true });
    if (scene.status === "archived") {
      return { archived: false, summaryScheduled: false };
    }
    await ctx.db.patch(sceneId, {
      status: "archived",
      endedAt: nowMs(),
    });
    await logAction(ctx, {
      sceneId,
      type: "scene.end",
      payload: { endedAt: nowMs() },
      inverse: {
        kind: "patchScene",
        sceneId,
        patch:
          scene.endedAt === undefined
            ? { status: scene.status }
            : { status: scene.status, endedAt: scene.endedAt },
        clearEndedAt: scene.endedAt === undefined,
      },
      userId,
    });
    await ctx.scheduler.runAfter(0, internal.generation.memory.runPass, {
      sceneId,
      force: true,
    });
    return { archived: true, summaryScheduled: true };
  },
});

/**
 * End-detection signal (PLAN §8.6, Phase 7.1): the director meta-agent's
 * `endingSuggested` flag increments a consecutive-result streak on the scene;
 * the play shell offers a non-modal "Wrap scene?" suggestion at streak ≥ 2.
 * Never auto-archives.
 */
export const recordEndingSignal = internalMutation({
  args: { sceneId: v.id("scenes"), suggested: v.boolean() },
  handler: async (ctx, { sceneId, suggested }) => {
    const scene = await ctx.db.get(sceneId);
    if (!scene || scene.status === "archived") return;
    await ctx.db.patch(sceneId, {
      endingStreak: suggested ? Math.min((scene.endingStreak ?? 0) + 1, 9) : 0,
    });
  },
});
