"use client";

import { CircleDollarSignIcon, CoinsIcon, TriangleAlertIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  budgetState,
  formatTokens,
  formatUsd,
} from "@/lib/usage/format";
import type { UsageView } from "./types";

/**
 * Usage meter (PLAN Appendix C, Phase 6.7): scene totals + per-tier
 * breakdown, soft-cap warning at 80% / 100%. Numbers are estimates and the UI
 * says so; generation is never hard-blocked in v1.
 */
export function UsageMeter({
  usage,
  softCapUsd,
}: {
  usage: UsageView;
  softCapUsd?: number;
}) {
  const budget = budgetState(usage.costEstimateUsd, softCapUsd);

  return (
    <div data-testid="usage-meter" className="space-y-3">
      <div className="flex items-center gap-1.5">
        <CoinsIcon className="size-3.5 text-muted-foreground" aria-hidden />
        <h3 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          Usage · estimated
        </h3>
        <Badge variant="outline" className="ml-auto font-normal">
          {usage.byTier.length} tier{usage.byTier.length === 1 ? "" : "s"}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat
          label="Cost"
          value={formatUsd(usage.costEstimateUsd)}
          icon={<CircleDollarSignIcon className="size-3.5" aria-hidden />}
        />
        <Stat label="Tokens in" value={formatTokens(usage.tokensIn)} />
        <Stat label="Tokens out" value={formatTokens(usage.tokensOut)} />
      </div>

      {softCapUsd && softCapUsd > 0 ? (
        <div
          data-testid="budget-bar"
          data-level={budget.level}
          className={`rounded-lg border p-2.5 ${
            budget.level === "over"
              ? "border-destructive/40 bg-destructive/5"
              : budget.level === "warn"
                ? "border-amber-500/40 bg-amber-500/5"
                : "border-border bg-card/60"
          }`}
        >
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">
              Soft cap {formatUsd(softCapUsd)}
            </span>
            <span
              className={
                budget.level === "over"
                  ? "text-destructive"
                  : budget.level === "warn"
                    ? "text-amber-600 dark:text-amber-300"
                    : "text-muted-foreground"
              }
            >
              {budget.label}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(Math.min(1, budget.pct) * 100)}
              aria-label="Soft cap usage"
              className={`h-full rounded-full transition-[width] ${
                budget.level === "over"
                  ? "bg-destructive"
                  : budget.level === "warn"
                    ? "bg-amber-500"
                    : "bg-primary"
              }`}
              style={{ width: `${Math.min(1, budget.pct) * 100}%` }}
            />
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          No soft cap set for this scene.
        </p>
      )}

      {usage.byTier.length > 0 ? (
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="pb-1 font-medium">Tier</th>
              <th className="pb-1 text-right font-medium">Tokens</th>
              <th className="pb-1 text-right font-medium">Est. cost</th>
            </tr>
          </thead>
          <tbody>
            {usage.byTier.map((tier) => (
              <tr key={tier.tier} className="border-t border-border/60">
                <td className="py-1 capitalize">{tier.tier}</td>
                <td className="py-1 text-right tabular-nums">
                  {formatTokens(tier.tokensIn + tier.tokensOut)}
                </td>
                <td className="py-1 text-right tabular-nums">
                  {formatUsd(tier.costEstimateUsd)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          No usage recorded yet. Estimated totals appear after the first
          generation.
        </p>
      )}

      {budget.level === "warn" || budget.level === "over" ? (
        <p className="flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-700 dark:text-amber-300">
          <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {budget.level === "over"
            ? `Estimated cost ${formatUsd(usage.costEstimateUsd)} is over the soft cap. Generation still works — raise the cap or wrap the scene.`
            : `Estimated cost is approaching the soft cap (${budget.label}).`}
        </p>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card/60 p-2">
      <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}
