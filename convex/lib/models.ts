/**
 * Logical model tiers → concrete provider/model resolution.
 * Tiers keep meta-agents cheap and spotlight roles strong, while allowing
 * per-deployment overrides via environment variables.
 */

export const MODEL_TIERS = ["spotlight", "standard", "cheap"] as const;
export type ModelTier = (typeof MODEL_TIERS)[number];

const DEFAULT_MODELS: Record<ModelTier, string> = {
  spotlight: "openai/gpt-4.1",
  standard: "openai/gpt-4.1-mini",
  cheap: "openai/gpt-4.1-nano",
};

const ENV_KEYS: Record<ModelTier, string> = {
  spotlight: "FABULA_MODEL_SPOTLIGHT",
  standard: "FABULA_MODEL_STANDARD",
  cheap: "FABULA_MODEL_CHEAP",
};

export type ResolvedModel = { provider: string; modelId: string; raw: string };

export function resolveModel(tier: ModelTier): ResolvedModel {
  const fromEnv = process.env[ENV_KEYS[tier]];
  const raw = (fromEnv ?? "").trim() || DEFAULT_MODELS[tier];
  const slash = raw.indexOf("/");
  if (slash <= 0 || slash === raw.length - 1) {
    throw new Error(
      `Invalid model config for tier "${tier}": "${raw}" (expected "provider/model")`,
    );
  }
  return { provider: raw.slice(0, slash), modelId: raw.slice(slash + 1), raw };
}
