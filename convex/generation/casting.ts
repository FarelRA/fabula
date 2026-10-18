import { action } from "../_generated/server";
import { v } from "convex/values";
import { internal, api } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import {
  CastingSchema,
  FieldRegenSchema,
  RoleCardSchema,
  RoleListSchema,
  type Casting,
  type RoleCard,
} from "../shared/contracts";
import { checkCast, type CastRoleLite, type CastViolation } from "../domain/castConstraints";
import { compileCastingPrompt, compileCastRegenPrompt, compileFieldRegenPrompt } from "../compiler/compileCasting";
import { contextWindowFor } from "../lib/modelRegistry";
import { resolveModel } from "../lib/models";
import { getGateway } from "../lib/gatewayFactory";
import { currentUserId } from "../lib/authz";
import { recordEstimatedUsage } from "./record";
import { toProposedRole } from "./helpers";
import type { RoleView } from "./context";

/**
 * Casting agent: full cast with programmatic constraint
 * checks + up to 2 repair passes, cast regen and field regen that respect
 * locks (locked values are copied from the previous card and excluded from
 * the ask). Residual violations surface as non-blocking warnings.
 */

function toLiteCast(roles: RoleCard[]): CastRoleLite[] {
  return roles.map((role) => ({
    name: role.identity.name,
    hook: role.hook,
    tier: role.meta.tier,
    relations: role.relations.map((relation) => ({
      toName: relation.toRoleId,
      dynamic: relation.dynamic,
      tension: relation.tension,
    })),
    voice: {
      register: role.voice.register,
      rhythm: role.voice.rhythm,
      sampleLines: role.voice.sampleLines,
    },
  }));
}

// ---------------------------------------------------------------------------
// Cast draft (wizard / quick start)
// ---------------------------------------------------------------------------

export const castDraft = action({
  args: {
    sceneId: v.id("scenes"),
    castSize: v.number(),
    vibeSteer: v.optional(v.string()),
    youInScene: v.optional(v.object({ name: v.string(), pronouns: v.optional(v.string()) })),
    updatePremise: v.optional(v.boolean()),
  },
  returns: v.object({
    roleIds: v.array(v.id("roles")),
    warnings: v.array(v.string()),
    premise: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ roleIds: Id<"roles">[]; warnings: string[]; premise: string }> => {
    const view = await ctx.runQuery(internal.generation.context.loadTurnContext, {
      sceneId: args.sceneId,
    });
    if (view.scene.activeTipBeatId !== undefined) {
      throw new Error("Scene is already playing. Cast changes must go through the role revision flow.");
    }
    const castSize = Math.min(8, Math.max(1, Math.round(args.castSize)));
    const resolved = resolveModel("spotlight");
    const contextWindow = contextWindowFor(resolved.raw);
    const outputReserve = 3000;
    const modelRef = { provider: resolved.provider, modelId: resolved.modelId, ref: resolved.raw };

    const compiled = compileCastingPrompt({
      templates: view.templates,
      model: modelRef,
      premise: view.scene.premise,
      genre: view.settings.genre,
      settingEra: view.settings.settingEra,
      castSize,
      vibeSteer: args.vibeSteer ?? "",
      humanRoleNote: "",
      contextWindow,
      outputReserve,
    });
    const gateway = getGateway();

    let cast: Casting | null = null;
    try {
      cast = await gateway.object({
        model: resolved.raw,
        system: compiled.system,
        messages: compiled.messages,
        schema: CastingSchema,
        schemaName: "casting",
        maxTokens: outputReserve,
      });
    } catch (error) {
      throw new Error(
        `Casting failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    let violations: CastViolation[] = checkCast(toLiteCast(cast.roles));
    for (let attempt = 0; attempt < 2 && violations.length > 0; attempt += 1) {
      const fix = `Fix these cast problems and return the full cast again: ${violations
        .map((violation) => `[${violation.code}] ${violation.message}`)
        .join("; ")}.`;
      try {
        cast = await gateway.object({
          model: resolved.raw,
          system: compiled.system,
          messages: [...compiled.messages, { role: "user" as const, content: fix }],
          schema: CastingSchema,
          schemaName: "casting",
          maxTokens: outputReserve,
        });
        violations = checkCast(toLiteCast(cast.roles));
      } catch {
        break;
      }
    }
    const warnings = violations.map(
      (violation) => `[${violation.code}] ${violation.message}`,
    );

    const roleIds = await ctx.runMutation(internal.generation.helpers.insertDraftBatch, {
      sceneId: args.sceneId,
      kind: "ai",
      premise: args.updatePremise === true ? cast.premise : undefined,
      roles: cast.roles.map(toProposedRole),
    });

    if (args.youInScene) {
      const humanCompiled = compileCastingPrompt({
        templates: view.templates,
        model: modelRef,
        premise: view.scene.premise,
        genre: view.settings.genre,
        settingEra: view.settings.settingEra,
        castSize: 1,
        vibeSteer: "",
        humanRoleNote: `The director plays ${args.youInScene.name}${
          args.youInScene.pronouns ? ` (${args.youInScene.pronouns})` : ""
        }. Generate exactly this one role card for them.`,
        contextWindow,
        outputReserve: 1500,
      });
      try {
        const humanCast = await gateway.object({
          model: resolved.raw,
          system: humanCompiled.system,
          messages: humanCompiled.messages,
          schema: CastingSchema,
          schemaName: "casting",
          maxTokens: 1500,
        });
        const humanRole = humanCast.roles[0];
        if (humanRole) {
          const userId = await currentUserId(ctx);
          const humanIds = await ctx.runMutation(internal.generation.helpers.insertDraftBatch, {
            sceneId: args.sceneId,
            kind: "human",
            userId: userId ?? undefined,
            roles: [toProposedRole(humanRole)],
          });
          roleIds.push(...humanIds);
        }
      } catch (error) {
        warnings.push(
          `Human role generation failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    await ctx.runMutation(internal.generation.snapshots.write, {
      sceneId: args.sceneId,
      mode: "casting",
      blocks: compiled.snapshot.blocks,
      model: compiled.snapshot.model,
      tokenCounts: compiled.snapshot.tokenCounts,
      budget: compiled.snapshot.budget,
    });
    await recordEstimatedUsage(ctx, {
      sceneId: args.sceneId,
      kind: "casting",
      tier: "spotlight",
      provider: resolved.provider,
      modelId: resolved.modelId,
      system: compiled.system,
      messages: compiled.messages,
      output: JSON.stringify(cast),
    });

    return { roleIds, warnings, premise: cast.premise };
  },
});

// ---------------------------------------------------------------------------
// Cast regen (audition: locks + vibe steer)
// ---------------------------------------------------------------------------

export const castRegen = action({
  args: { sceneId: v.id("scenes"), vibeSteer: v.optional(v.string()) },
  returns: v.object({ updated: v.array(v.id("roles")), warnings: v.array(v.string()) }),
  handler: async (ctx, args): Promise<{ updated: Id<"roles">[]; warnings: string[] }> => {
    const view = await ctx.runQuery(internal.generation.context.loadTurnContext, {
      sceneId: args.sceneId,
    });
    const existing: RoleView[] = view.roles.filter(
      (role) => role.kind === "ai" && role.status !== "retired",
    );
    if (existing.length === 0) throw new Error("No cast to regenerate");

    const resolved = resolveModel("spotlight");
    const contextWindow = contextWindowFor(resolved.raw);
    const outputReserve = 3000;
    const modelRef = { provider: resolved.provider, modelId: resolved.modelId, ref: resolved.raw };

    const castSummary = existing
      .map((role) => `${role.name} (${role.tier}, ${role.storyRole}): ${role.card.hook}`)
      .join("\n");

    const compiled = compileCastRegenPrompt({
      templates: view.templates,
      model: modelRef,
      castSize: existing.length,
      locks: existing.flatMap((role) => role.draftLocks),
      vibe: args.vibeSteer ?? "",
      castSummary,
      scene: `${view.scene.premise} · ${view.settings.genre} · ${view.settings.settingEra}`,
      contextWindow,
      outputReserve,
    });
    const gateway = getGateway();

    const warnings: string[] = [];
    let roles: RoleCard[] | null = null;
    try {
      const out = await gateway.object({
        model: resolved.raw,
        system: compiled.system,
        messages: compiled.messages,
        schema: RoleListSchema,
        schemaName: "castRegen",
        maxTokens: outputReserve,
      });
      roles = out.roles;
    } catch (error) {
      try {
        const out = await gateway.object({
          model: resolved.raw,
          system: compiled.system,
          messages: [
            ...compiled.messages,
            {
              role: "user" as const,
              content: `Your previous response failed validation (${
                error instanceof Error ? error.message : String(error)
              }). Return the full cast JSON now.`,
            },
          ],
          schema: RoleListSchema,
          schemaName: "castRegen",
          maxTokens: outputReserve,
        });
        roles = out.roles;
      } catch {
        roles = null;
      }
    }
    if (!roles) throw new Error("Cast regeneration failed after retry");

    if (roles.length !== existing.length) {
      warnings.push(
        `Model returned ${roles.length} roles for ${existing.length} slots, deterministically padded/truncated.`,
      );
      roles = Array.from(
        { length: existing.length },
        (_, index) => roles?.[index % roles.length] as RoleCard,
      );
    }

    const violations = checkCast(toLiteCast(roles));
    warnings.push(...violations.map((violation) => `[${violation.code}] ${violation.message}`));

    const updated = await ctx.runMutation(internal.generation.helpers.applyCastRegen, {
      sceneId: args.sceneId,
      roles: roles.map(toProposedRole),
      effectiveFromBeatId: view.scene.activeTipBeatId,
    });

    await ctx.runMutation(internal.generation.snapshots.write, {
      sceneId: args.sceneId,
      mode: "castRegen",
      blocks: compiled.snapshot.blocks,
      model: compiled.snapshot.model,
      tokenCounts: compiled.snapshot.tokenCounts,
      budget: compiled.snapshot.budget,
    });
    await recordEstimatedUsage(ctx, {
      sceneId: args.sceneId,
      kind: "castRegen",
      tier: "spotlight",
      provider: resolved.provider,
      modelId: resolved.modelId,
      system: compiled.system,
      messages: compiled.messages,
      output: JSON.stringify(roles),
    });

    return { updated, warnings };
  },
});

// ---------------------------------------------------------------------------
// Field regen (single field, locks respected)
// ---------------------------------------------------------------------------

const FIELD_KEYS = [
  "identity",
  "hook",
  "psychology",
  "voice",
  "drives",
  "boundariesLines",
  "meta",
] as const;

export const fieldRegen = action({
  args: { roleId: v.id("roles"), fields: v.array(v.string()) },
  returns: v.object({
    applied: v.array(v.string()),
    skippedLocked: v.array(v.string()),
    warnings: v.array(v.string()),
    changed: v.boolean(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    applied: string[];
    skippedLocked: string[];
    warnings: string[];
    changed: boolean;
  }> => {
    const loaded = await ctx.runQuery(internal.generation.context.loadRoleContext, {
      roleId: args.roleId,
    });
    const role = loaded.role;
    const locked = role.draftLocks;
    const skippedLocked = args.fields.filter((field) => locked.includes(field));
    const requested = args.fields.filter(
      (field) => !locked.includes(field) && (FIELD_KEYS as readonly string[]).includes(field),
    );
    if (requested.length === 0) {
      return { applied: [], skippedLocked, warnings: [], changed: false };
    }

    const resolved = resolveModel("standard");
    const contextWindow = contextWindowFor(resolved.raw);
    const outputReserve = 1200;
    const modelRef = { provider: resolved.provider, modelId: resolved.modelId, ref: resolved.raw };

    const roleObject = role.rawCard;

    const compiled = compileFieldRegenPrompt({
      templates: loaded.templates,
      model: modelRef,
      fields: requested,
      locks: locked,
      roleJson: JSON.stringify(role.card),
      scene: `${loaded.scene.premise} · ${loaded.settings.genre} · ${loaded.settings.settingEra}`,
      contextWindow,
      outputReserve,
    });

    const gateway = getGateway();
    let parsedFields: Record<string, unknown>;
    try {
      const out = await gateway.object({
        model: resolved.raw,
        system: compiled.system,
        messages: compiled.messages,
        schema: FieldRegenSchema,
        schemaName: "fieldRegen",
        maxTokens: outputReserve,
      });
      parsedFields = out.fields;
    } catch (error) {
      throw new Error(
        `Field regeneration failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const warnings: string[] = [];
    const patch: {
      identity?: Doc<"roles">["identity"];
      hook?: string;
      psychology?: Doc<"roles">["psychology"];
      voice?: Doc<"roles">["voice"];
      drives?: Doc<"roles">["drives"];
      boundariesLines?: string[];
      meta?: Doc<"roles">["meta"];
    } = {};

    for (const [key, value] of Object.entries(parsedFields)) {
      if (!requested.includes(key)) continue;
      const candidate = { ...roleObject, [key]: value };
      const check = RoleCardSchema.safeParse(candidate);
      if (!check.success) {
        warnings.push(`Field "${key}" failed validation and was dropped`);
        continue;
      }
      if (key === "identity") {
        patch.identity = {
          ...(roleObject.identity as Doc<"roles">["identity"]),
          ...(value as Doc<"roles">["identity"]),
        };
      }
      if (key === "hook") patch.hook = value as string;
      if (key === "psychology") patch.psychology = value as Doc<"roles">["psychology"];
      if (key === "voice") patch.voice = value as Doc<"roles">["voice"];
      if (key === "drives") patch.drives = value as Doc<"roles">["drives"];
      if (key === "boundariesLines") patch.boundariesLines = value as string[];
      if (key === "meta") patch.meta = value as Doc<"roles">["meta"];
    }

    const applied = Object.keys(patch);
    if (applied.length === 0) {
      return { applied: [], skippedLocked, warnings, changed: false };
    }

    if (loaded.scene.activeTipBeatId) {
      await ctx.runMutation(api.cast.reviseRole, {
        roleId: args.roleId,
        effectiveFromBeatId: loaded.scene.activeTipBeatId,
        patch,
        origin: "regen",
      });
    } else {
      await ctx.runMutation(api.cast.updateDraft, { roleId: args.roleId, patch });
    }

    await ctx.runMutation(internal.generation.snapshots.write, {
      sceneId: loaded.scene.id,
      mode: "fieldRegen",
      roleId: args.roleId,
      blocks: compiled.snapshot.blocks,
      model: compiled.snapshot.model,
      tokenCounts: compiled.snapshot.tokenCounts,
      budget: compiled.snapshot.budget,
    });
    await recordEstimatedUsage(ctx, {
      sceneId: loaded.scene.id,
      kind: "fieldRegen",
      tier: "standard",
      provider: resolved.provider,
      modelId: resolved.modelId,
      system: compiled.system,
      messages: compiled.messages,
      output: JSON.stringify(parsedFields),
    });

    return { applied, skippedLocked, warnings, changed: true };
  },
});
