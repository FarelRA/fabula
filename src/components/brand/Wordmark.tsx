import Link from "next/link";
import { DramaIcon } from "lucide-react";
import { cn } from "cn";

/**
 * The house mark. A small proscenium mask and the wordmark, with an optional
 * context label for the studio and play surfaces. Kept server-renderable so
 * every route can use the same identity without a client boundary.
 */
export function Wordmark({
  href = "/",
  className,
  context,
  ornate = false,
}: {
  href?: string;
  className?: string;
  context?: string;
  ornate?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex min-w-0 items-center gap-2.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "relative flex shrink-0 items-center justify-center overflow-hidden border border-primary/30 bg-primary/10 text-primary transition-colors group-hover:border-primary/60 group-hover:bg-primary/15",
          ornate ? "size-9 rounded-sm" : "size-8 rounded-sm",
        )}
      >
        <DramaIcon className={ornate ? "size-[1.15rem]" : "size-4"} strokeWidth={1.6} />
      </span>
      <span className="flex min-w-0 items-baseline gap-2">
        <span
          className={cn(
            "font-serif font-semibold tracking-[0.08em] text-foreground",
            ornate ? "text-xl" : "text-lg",
          )}
        >
          Fabula
        </span>
        {context ? (
          <span className="cue hidden text-[0.6rem] text-primary sm:inline">{context}</span>
        ) : null}
      </span>
    </Link>
  );
}
