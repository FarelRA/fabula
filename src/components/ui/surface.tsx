import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

/**
 * The shared surface family. Every panel, card and inset in the studio should
 * come from this ladder rather than inventing another border/background pair.
 *
 * - `raised`: the default editorial panel, with a warm top edge.
 * - `recessed`: the unlit stage floor, used for manuscript and reading areas.
 * - `glow`: the active cue or highlighted decision.
 * - `flat`: a quiet grouping with no shadow.
 */
const surfaceVariants = cva("relative min-w-0 rounded-lg border transition-colors", {
  variants: {
    tone: {
      raised: "panel-raised text-card-foreground",
      recessed: "panel-recessed text-card-foreground",
      glow: "panel-raised panel-glow text-card-foreground",
      flat: "border-border/80 bg-card/60 text-card-foreground",
      bare: "border-transparent bg-transparent",
    },
    padding: {
      none: "p-0",
      sm: "p-3",
      md: "p-4 sm:p-5",
      lg: "p-5 sm:p-7",
      xl: "p-6 sm:p-9",
    },
  },
  defaultVariants: {
    tone: "raised",
    padding: "md",
  },
});

export type SurfaceProps = React.ComponentProps<"div"> &
  VariantProps<typeof surfaceVariants>;

export function Surface({
  className,
  tone = "raised",
  padding = "md",
  ...props
}: SurfaceProps) {
  return (
    <div
      data-slot="surface"
      data-tone={tone}
      className={cn(surfaceVariants({ tone, padding }), className)}
      {...props}
    />
  );
}

export { surfaceVariants };
