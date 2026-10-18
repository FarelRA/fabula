/**
 * Usage-meter formatting and budget policy.
 * Numbers are estimates and the UI labels them as such.
 */

export type TierUsage = {
  tokensIn: number;
  tokensOut: number;
  costEstimateUsd: number;
};

export type NormalizedTierUsage = TierUsage & { tier: string };

export function normalizeByTier(byTier: unknown): NormalizedTierUsage[] {
  if (!byTier || typeof byTier !== "object") return [];
  const entries = Object.entries(byTier as Record<string, unknown>);
  return entries
    .map(([tier, value]) => {
      const row = (value ?? {}) as Partial<TierUsage>;
      return {
        tier,
        tokensIn: readNumber(row.tokensIn),
        tokensOut: readNumber(row.tokensOut),
        costEstimateUsd: readNumber(row.costEstimateUsd),
      };
    })
    .filter(
      (row) => row.tokensIn > 0 || row.tokensOut > 0 || row.costEstimateUsd > 0,
    )
    .sort((a, b) => b.costEstimateUsd - a.costEstimateUsd);
}

function readNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function formatTokens(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(Math.round(value));
}

export function formatUsd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "$0.00";
  if (value < 0.01) return "<$0.01";
  return `$${value.toFixed(2)}`;
}

export type BudgetLevel = "none" | "ok" | "warn" | "over";

export function budgetState(
  costUsd: number,
  softCapUsd?: number,
): { level: BudgetLevel; pct: number; label: string } {
  if (!softCapUsd || softCapUsd <= 0) {
    return { level: "none", pct: 0, label: "No soft cap set" };
  }
  const pct = Math.min(1.5, Math.max(0, costUsd / softCapUsd));
  if (pct >= 1) {
    return {
      level: "over",
      pct,
      label: `${Math.round(pct * 100)}% of the soft cap, over budget`,
    };
  }
  if (pct >= 0.8) {
    return {
      level: "warn",
      pct,
      label: `${Math.round(pct * 100)}% of the soft cap`,
    };
  }
  return { level: "ok", pct, label: `${Math.round(pct * 100)}% of the soft cap` };
}
