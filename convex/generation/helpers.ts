import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { RoleCard } from "../shared/contracts";
import { copyPaths } from "../lib/patch";
import { sortKeyFor } from "../lib/ids";
import { nowMs } from "../lib/time";
import { modelTierV, relationDynamicV, storyRoleV, tierV } from "../lib/validators";

/**
 * Generation helpers: small internal mutations/queries live HERE (not in the
 * action modules) so actions can reference them via `internal.generation.helpers.*`
 * without creating module self-reference type cycles.
 */

export type ProposedRole = {
  identity: {
    name: string;
    monogram: string;
    ageEra: string;
    pronouns: string;
    occupation: string;
    accentColor: string;
    avatarPrompt?: string;
  };
  hook: string;
  psychology: RoleCard["psychology"];
  voice: RoleCard["voice"];
  drives: RoleCard["drives"];
  boundariesLines: string[];
  relations: Array<{
    toName: string;
    dynamic: RoleCard["relations"][number]["dynamic"];
    tension: number;
    historyNote: string;
    knowsAbout: string;
  }>;
  meta: RoleCard["meta"];
};

export const proposedRoleV = v.object({
  identity: v.object({
    name: v.string(),
    monogram: v.string(),
    ageEra: v.string(),
    pronouns: v.string(),
    occupation: v.string(),
    accentColor: v.string(),
    avatarPrompt: v.optional(v.string()),
  }),
  hook: v.string(),
  psychology: v.object({
    traits: v.array(v.string()),
    dials: v.object({
      warmth: v.number(),
      impulse: v.number(),
      guile: v.number(),
      optimism: v.number(),
    }),
    flaws: v.array(v.string()),
    fears: v.array(v.string()),
    desires: v.array(v.string()),
    secret: v.string(),
  }),
  voice: v.object({
    register: v.string(),
    rhythm: v.string(),
    verbosity: v.string(),
    vocabularyNotes: v.string(),
    verbalTics: v.array(v.string()),
    sampleLines: v.array(v.string()),
    doNotSay: v.array(v.string()),
    narrationStyle: v.string(),
  }),
  drives: v.object({
    publicGoal: v.string(),
    secretGoal: v.string(),
    stakes: v.string(),
  }),
  boundariesLines: v.array(v.string()),
  relations: v.array(
    v.object({
      toName: v.string(),
      dynamic: relationDynamicV,
      tension: v.number(),
      historyNote: v.string(),
      knowsAbout: v.string(),
    }),
  ),
  meta: v.object({
    storyRole: storyRoleV,
    tier: tierV,
    modelTier: modelTierV,
    temperature: v.optional(v.number()),
  }),
});

export function toProposedRole(role: RoleCard): ProposedRole {
  return {
    identity: {
      name: role.identity.name,
      monogram: role.identity.monogram,
      ageEra: role.identity.ageEra,
      pronouns: role.identity.pronouns,
      occupation: role.identity.occupation,
      accentColor: role.identity.accentColor,
    },
    hook: role.hook,
    psychology: role.psychology,
    voice: role.voice,
    drives: role.drives,
    boundariesLines: role.boundariesLines,
    relations: role.relations.map((relation) => ({
      toName: relation.toRoleId,
      dynamic: relation.dynamic,
      tension: relation.tension,
      historyNote: relation.historyNote,
      knowsAbout: relation.knowsAbout,
    })),
    meta: role.meta,
  };
}

function roleDocToObject(role: Doc<"roles">): Record<string, unknown> {
  return {
    identity: { ...role.identity },
    hook: role.hook,
    psychology: { ...role.psychology },
    voice: { ...role.voice },
    drives: { ...role.drives },
    boundariesLines: [...role.boundariesLines],
    relations: role.relations.map((relation) => ({ ...relation })),
    meta: { ...role.meta },
  };
}

// ---------------------------------------------------------------------------
// Casting persistence
// ---------------------------------------------------------------------------

export const insertDraftBatch = internalMutation({
  args: {
    sceneId: v.id("scenes"),
    kind: v.union(v.literal("ai"), v.literal("human")),
    userId: v.optional(v.id("users")),
    premise: v.optional(v.string()),
    roles: v.array(proposedRoleV),
  },
  returns: v.array(v.id("roles")),
  handler: async (ctx, args) => {
    const scene = await ctx.db.get(args.sceneId);
    if (!scene) throw new Error("Scene not found");
    const existing = await ctx.db
      .query("roles")
      .withIndex("by_scene", (q) => q.eq("sceneId", args.sceneId))
      .collect();
    const offset = existing.length;

    const nameToId = new Map<string, Id<"roles">>();
    const ids: Id<"roles">[] = [];
    for (const [index, role] of args.roles.entries()) {
      const roleId = await ctx.db.insert("roles", {
        sceneId: args.sceneId,
        kind: args.kind,
        userId: args.userId,
        identity: role.identity,
        hook: role.hook,
        psychology: role.psychology,
        voice: role.voice,
        drives: role.drives,
        boundariesLines: role.boundariesLines,
        relations: [],
        meta: role.meta,
        status: "active",
        statusChangedAtSeq: scene.seqCounter,
        sortKey: sortKeyFor(offset + index),
        draftLocks: [],
      });
      nameToId.set(role.identity.name, roleId);
      ids.push(roleId);
    }

    for (const [index, role] of args.roles.entries()) {
      const roleId = ids[index];
      if (!roleId) continue;
      const relations: Doc<"roles">["relations"] = [];
      for (const relation of role.relations) {
        const toId = nameToId.get(relation.toName);
        if (!toId || toId === roleId) continue;
        relations.push({
          toRoleId: toId,
          dynamic: relation.dynamic,
          tension: relation.tension,
          historyNote: relation.historyNote,
          knowsAbout: relation.knowsAbout,
        });
      }
      await ctx.db.patch(roleId, { relations });
    }

    if (args.premise && args.premise.trim().length > 0) {
      await ctx.db.patch(scene._id, { premise: args.premise });
    }
    return ids;
  },
});

export const applyCastRegen = internalMutation({
  args: {
    sceneId: v.id("scenes"),
    roles: v.array(proposedRoleV),
    effectiveFromBeatId: v.optional(v.id("beats")),
  },
  returns: v.array(v.id("roles")),
  handler: async (ctx, args) => {
    const scene = await ctx.db.get(args.sceneId);
    if (!scene) throw new Error("Scene not found");
    const existing = (
      await ctx.db
        .query("roles")
        .withIndex("by_scene", (q) => q.eq("sceneId", args.sceneId))
        .collect()
    )
      .filter((role) => role.status !== "retired" && role.kind === "ai")
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    const count = Math.min(existing.length, args.roles.length);
    const nameToId = new Map<string, Id<"roles">>();
    for (let index = 0; index < count; index += 1) {
      const proposed = args.roles[index];
      const role = existing[index];
      if (proposed && role) nameToId.set(proposed.identity.name, role._id);
    }

    let effectiveSeq = scene.seqCounter;
    if (args.effectiveFromBeatId) {
      const beat = await ctx.db.get(args.effectiveFromBeatId);
      effectiveSeq = beat?.seq ?? effectiveSeq;
    }

    const updated: Id<"roles">[] = [];
    for (let index = 0; index < count; index += 1) {
      const proposed = args.roles[index];
      const role = existing[index];
      if (!proposed || !role) continue;

      const previous = roleDocToObject(role);
      const nextCard: Record<string, unknown> = {
        identity: { ...role.identity, ...proposed.identity },
        hook: proposed.hook,
        psychology: proposed.psychology,
        voice: proposed.voice,
        drives: proposed.drives,
        boundariesLines: proposed.boundariesLines,
        relations: [],
        meta: proposed.meta,
      };
      // Locked fields win, copied from the previous card (byte-identical).
      copyPaths(previous, nextCard, role.draftLocks);

      const relations: Doc<"roles">["relations"] = [];
      for (const relation of proposed.relations) {
        const toId = nameToId.get(relation.toName);
        if (!toId || toId === role._id) continue;
        relations.push({
          toRoleId: toId,
          dynamic: relation.dynamic,
          tension: relation.tension,
          historyNote: relation.historyNote,
          knowsAbout: relation.knowsAbout,
        });
      }
      nextCard.relations = relations;

      const patch = {
        identity: nextCard.identity as Doc<"roles">["identity"],
        hook: nextCard.hook as string,
        psychology: nextCard.psychology as Doc<"roles">["psychology"],
        voice: nextCard.voice as Doc<"roles">["voice"],
        drives: nextCard.drives as Doc<"roles">["drives"],
        boundariesLines: nextCard.boundariesLines as string[],
        relations,
        meta: nextCard.meta as Doc<"roles">["meta"],
      };

      if (args.effectiveFromBeatId) {
        const revisionId = await ctx.db.insert("roleRevisions", {
          roleId: role._id,
          sceneId: scene._id,
          effectiveFromBeatId: args.effectiveFromBeatId,
          effectiveSeq,
          card: nextCard,
          changedFields: ["castRegen"],
          origin: "vibeSteer",
          createdAt: nowMs(),
        });
        await ctx.db.patch(role._id, { ...patch, currentRevisionId: revisionId });
      } else {
        await ctx.db.patch(role._id, patch);
      }
      updated.push(role._id);
    }
    return updated;
  },
});

// ---------------------------------------------------------------------------
// Avatars
// ---------------------------------------------------------------------------

export const setAvatar = internalMutation({
  args: { roleId: v.id("roles"), storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const role = await ctx.db.get(args.roleId);
    if (!role) throw new Error("Role not found");
    await ctx.db.patch(args.roleId, {
      identity: { ...role.identity, avatarStorageId: args.storageId },
    });
  },
});

// ---------------------------------------------------------------------------
// Voice samples
// ---------------------------------------------------------------------------

export const getSampleCache = internalQuery({
  args: { roleId: v.id("roles") },
  returns: v.union(v.object({ hash: v.string(), lines: v.array(v.string()) }), v.null()),
  handler: async (ctx, { roleId }) => {
    const role = await ctx.db.get(roleId);
    if (!role || !role.sampleCache) return null;
    return { hash: role.sampleCache.hash, lines: role.sampleCache.lines };
  },
});

export const setSampleCache = internalMutation({
  args: { roleId: v.id("roles"), hash: v.string(), lines: v.array(v.string()) },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.roleId, {
      sampleCache: { hash: args.hash, lines: args.lines, createdAt: nowMs() },
    });
  },
});

// ---------------------------------------------------------------------------
// Continuity warnings
// ---------------------------------------------------------------------------

export const insertWarnings = internalMutation({
  args: {
    sceneId: v.id("scenes"),
    beatId: v.id("beats"),
    warnings: v.array(
      v.object({
        text: v.string(),
        severity: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
      }),
    ),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    for (const warning of args.warnings) {
      await ctx.db.insert("continuityWarnings", {
        sceneId: args.sceneId,
        beatId: args.beatId,
        text: warning.text,
        severity: warning.severity,
        status: "open",
        createdAt: nowMs(),
      });
    }
    return args.warnings.length;
  },
});
