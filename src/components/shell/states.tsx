"use client";

import { CloudOffIcon, LoaderCircleIcon, RefreshCwIcon, SparklesIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "cn";

/**
 * States catalog: every surface designs loading, empty,
 * error, offline and reconnecting states, these are the shared primitives.
 */

export function EmptyState({
  icon: Icon = SparklesIcon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        className,
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
        <Icon className="size-4" aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="font-heading text-sm font-medium text-foreground">{title}</p>
        {description ? (
          <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description = "The last action didn't go through. Your story is safe. Try again.",
  onRetry,
  retryLabel = "Try again",
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        className,
      )}
    >
      <div className="space-y-1">
        <p className="font-heading text-sm font-medium text-foreground">{title}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCwIcon aria-hidden />
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}

export function LoadingState({
  label = "Loading…",
  rows = 3,
  className,
}: {
  label?: string;
  rows?: number;
  className?: string;
}) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={cn("space-y-3 px-6 py-8", className)}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      ))}
    </div>
  );
}

export function OfflineBanner({
  message = "You're offline, actions that change the story are paused until you reconnect.",
}: {
  message?: string;
}) {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 border-t border-border bg-muted px-3 py-1.5 text-xs text-muted-foreground"
    >
      <CloudOffIcon className="size-3.5 text-primary" aria-hidden />
      {message}
    </div>
  );
}

export function ReconnectingBanner({
  message = "Reconnecting…",
}: {
  message?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 border-t border-border bg-muted px-3 py-1.5 text-xs text-muted-foreground"
    >
      <LoaderCircleIcon className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
      {message}
    </div>
  );
}
