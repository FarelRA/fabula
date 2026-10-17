import { action } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { createOpenAI } from "@ai-sdk/openai";
import { generateImage } from "ai";
import type { Id } from "../_generated/dataModel";
import { isFakeMode } from "../lib/modelRegistry";

/**
 * Avatar generation (PLAN §2.3): ALWAYS asynchronous and never blocking —
 * the UI renders a deterministic gradient+monogram placeholder immediately.
 * Without a configured image model (or in fake mode) this returns `skipped`
 * and the placeholder simply stays (zero dependencies on images).
 */
export const generate = action({
  args: { roleId: v.id("roles") },
  returns: v.object({
    status: v.union(v.literal("ready"), v.literal("skipped"), v.literal("failed")),
    storageId: v.optional(v.id("_storage")),
    reason: v.optional(v.string()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    status: "ready" | "skipped" | "failed";
    storageId?: Id<"_storage">;
    reason?: string;
  }> => {
    const imageModel = typeof process === "undefined" ? undefined : process.env.FABULA_IMAGE_MODEL;
    if (isFakeMode() || !imageModel) {
      return {
        status: "skipped" as const,
        reason: "No image model configured — the gradient+monogram placeholder stays",
      };
    }
    try {
      const loaded = await ctx.runQuery(internal.generation.context.loadRoleContext, {
        roleId: args.roleId,
      });
      const apiKey = typeof process === "undefined" ? undefined : process.env.OPENAI_API_KEY;
      if (!apiKey) return { status: "skipped" as const, reason: "OPENAI_API_KEY missing" };

      const openai = createOpenAI({ apiKey });
      const { image } = await generateImage({
        model: openai.image(imageModel),
        prompt: `Painterly character portrait, head and shoulders, no text, no watermark: ${loaded.role.name} — ${loaded.role.card.hook}`,
        size: "1024x1024",
      });
      const bytes = Uint8Array.from(image.uint8Array);
      const storageId = await ctx.storage.store(
        new Blob([bytes.buffer], { type: image.mediaType ?? "image/png" }),
      );
      await ctx.runMutation(internal.generation.helpers.setAvatar, {
        roleId: args.roleId,
        storageId,
      });
      return { status: "ready" as const, storageId };
    } catch (error) {
      return {
        status: "failed" as const,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  },
});
