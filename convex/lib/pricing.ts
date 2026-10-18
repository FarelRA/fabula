/**
 * Pricing table for the usage meter.
 * Values are USD per 1M tokens and are estimates, labeled as such in the UI.
 * Override per deployment with FABULA_PRICING_JSON:
 *   { "openai/gpt-4.1": { "in": 2, "out": 8 } }
 */

export type PricePerMTok = { input: number; output: number };

const DEFAULT_PRICES: Record<string, PricePerMTok> = {
  "openai/gpt-4.1": { input: 2, output: 8 },
  "openai/gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "openai/gpt-4.1-nano": { input: 0.1, output: 0.4 },
  "anthropic/claude-sonnet-4.5": { input: 3, output: 15 },
  "anthropic/claude-haiku-4.5": { input: 1, output: 5 },
};

const FALLBACK: PricePerMTok = { input: 3, output: 12 };

type RawOverride = { in?: number; out?: number; input?: number; output?: number };

function readEnvOverrides(): Record<string, PricePerMTok> {
  const raw = process.env.FABULA_PRICING_JSON;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, RawOverride>;
    const out: Record<string, PricePerMTok> = {};
    for (const [model, entry] of Object.entries(parsed)) {
      const input = entry.input ?? entry.in;
      const output = entry.output ?? entry.out;
      if (typeof input === "number" && typeof output === "number") {
        out[model] = { input, output };
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function priceFor(model: string): PricePerMTok {
  const overrides = readEnvOverrides();
  const override = overrides[model];
  if (override) return override;
  return DEFAULT_PRICES[model] ?? FALLBACK;
}

export function estimateCostUsd(model: string, tokensIn: number, tokensOut: number): number {
  const price = priceFor(model);
  const usd = (tokensIn / 1_000_000) * price.input + (tokensOut / 1_000_000) * price.output;
  return Math.round(usd * 1e6) / 1e6;
}
