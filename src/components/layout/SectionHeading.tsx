import * as React from "react";
import { cn } from "cn";

/**
 * A section header in the house voice: a small all-caps cue, a literary
 * headline, an optional stage-direction subtitle and a right-aligned action.
 */
export function SectionHeading({
  cue,
  title,
  description,
  action,
  level = 2,
  className,
  titleClassName,
}: {
  cue?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  level?: 1 | 2 | 3;
  className?: string;
  titleClassName?: string;
}) {
  const Heading = `h${level}` as "h1" | "h2" | "h3";
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-1.5">
        {cue ? <p className="cue text-primary">{cue}</p> : null}
        <Heading
          className={cn(
            "font-serif text-2xl leading-tight tracking-[-0.01em] text-foreground sm:text-3xl",
            titleClassName,
          )}
        >
          {title}
        </Heading>
        {description ? (
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
