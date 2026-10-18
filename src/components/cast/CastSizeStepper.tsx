"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CAST_MAX,
  CAST_MIN,
  castSizeHint,
  tierDefaultsForSize,
} from "@/lib/cast/tierPolicy";
import { cn } from "cn";

/**
 * Cast size stepper: 1 to 8, 2 to 4 recommended, ≥5 explains turn
 * throughput/cost inline (never a modal). Also previews the tier assignment so
 * the sizing policy is honest before generation.
 */
export function CastSizeStepper({
  value,
  onChange,
  disabled,
  showTierPreview = false,
  className,
}: {
  value: number;
  onChange: (size: number) => void;
  disabled?: boolean;
  showTierPreview?: boolean;
  className?: string;
}) {
  const hint = castSizeHint(value);
  const tiers = tierDefaultsForSize(value);
  const spotlight = tiers.filter((tier) => tier === "spotlight").length;
  const supporting = tiers.filter((tier) => tier === "supporting").length;
  const background = tiers.filter((tier) => tier === "background").length;

  return (
    <div className={cn("space-y-2", className)}>
      <div
        role="group"
        aria-label="Cast size"
        className="flex items-center gap-2"
      >
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Decrease cast size"
          disabled={disabled || value <= CAST_MIN}
          onClick={() => onChange(Math.max(CAST_MIN, value - 1))}
        >
          <MinusIcon />
        </Button>
        <output
          aria-live="polite"
          className="min-w-8 text-center text-base font-semibold tabular-nums"
        >
          {value}
        </output>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Increase cast size"
          disabled={disabled || value >= CAST_MAX}
          onClick={() => onChange(Math.min(CAST_MAX, value + 1))}
        >
          <PlusIcon />
        </Button>
        <span className="text-sm text-muted-foreground">roles</span>
        <span className="ml-1 text-xs text-muted-foreground">2 to 4 recommended</span>
      </div>

      {showTierPreview ? (
        <p className="text-xs text-muted-foreground">
          Tiers: {spotlight} spotlight
          {supporting > 0 ? ` · ${supporting} supporting` : ""}
          {background > 0 ? ` · ${background} background` : ""}
        </p>
      ) : null}

      {hint ? (
        <p className="max-w-prose text-xs leading-relaxed text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
