import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import type { GenerationMode } from "../shared/contracts";
import { estimateTokens } from "../lib/tokenBudget";
import type { ChatMessage } from "../lib/gateway";

/**
 * Object-mode generations don't carry provider token accounting through our
 * gateway abstraction; we record grounded estimates (chars/4) so the usage
 * meter reflects every call (PLAN §4.5).
 */
export async function recordEstimatedUsage(
  ctx: ActionCtx,
  args: {
    sceneId: Id<"scenes">;
    kind: GenerationMode;
    tier: string;
    provider: string;
    modelId: string;
    system: string;
    messages: ChatMessage[];
    output: string;
  },
): Promise<void> {
  const tokensIn =
    estimateTokens(args.system) +
    args.messages.reduce((sum, message) => sum + estimateTokens(message.content), 0);
  const tokensOut = estimateTokens(args.output);
  await ctx.runMutation(internal.usage.record, {
    sceneId: args.sceneId,
    tier: args.tier,
    provider: args.provider,
    modelId: args.modelId,
    kind: args.kind,
    tokensIn,
    tokensOut,
  });
}
