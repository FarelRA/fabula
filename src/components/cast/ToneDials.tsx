"use client";

import type { ToneDials as ToneDialsValue } from "@convex/shared/contracts";
import { Slider } from "@/components/ui/slider";
import { TONE_DIALS } from "@/lib/cast/wizard";
import { cn } from "cn";

/** Three tone dials in [-1, 1] with plain-language ends. */
export function ToneDials({
  value,
  onChange,
  disabled,
  className,
}: {
  value: ToneDialsValue;
  onChange: (next: ToneDialsValue) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      {TONE_DIALS.map((dial) => (
        <div key={dial.key} className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{dial.left}</span>
            <span className="tabular-nums text-foreground/70">
              {value[dial.key].toFixed(1)}
            </span>
            <span>{dial.right}</span>
          </div>
          <Slider
            aria-label={`${dial.left} to ${dial.right}`}
            min={-1}
            max={1}
            step={0.1}
            value={[value[dial.key]]}
            disabled={disabled}
            onValueChange={(next) => {
              const first = next[0] ?? 0;
              onChange({ ...value, [dial.key]: first });
            }}
          />
        </div>
      ))}
    </div>
  );
}
