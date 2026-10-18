"use client";

import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import type { PresentationStyle } from "@convex/shared/contracts";
import { cn } from "cn";

/**
 * Beat body renderer: sanitized markdown, with the
 * three presentation styles expressed in typography rather than separate data.
 */
export function BeatContent({
  text,
  style,
  className,
  streaming = false,
}: {
  text: string;
  style: PresentationStyle;
  className?: string;
  streaming?: boolean;
}) {
  const typography =
    style === "novel"
      ? "font-serif text-[1.05rem] leading-[1.75] sm:text-lg"
      : style === "script"
        ? "font-mono text-[0.82rem] leading-[1.7]"
        : "text-[0.95rem] leading-[1.7]";

  return (
    <div
      data-style={style}
      data-streaming={streaming ? "true" : undefined}
      className={cn(
        "min-w-0 break-words text-foreground/90",
        typography,
        "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
        "[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
        "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]",
        "[&_em]:text-foreground/75",
        "[&_h1]:font-heading [&_h1]:text-lg [&_h1]:font-semibold",
        "[&_h2]:font-heading [&_h2]:text-base [&_h2]:font-semibold",
        "[&_hr]:my-3 [&_hr]:border-border",
        "[&_li]:ml-4 [&_li]:list-disc [&_li]:marker:text-muted-foreground",
        "[&_ol>li]:list-decimal",
        "[&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_strong]:text-foreground",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          a: ({ node, ...props }) => {
            void node;
            return <a {...props} target="_blank" rel="noreferrer noopener" />;
          },
        }}
      >
        {text}
      </ReactMarkdown>
      {streaming ? (
        <span
          aria-hidden
          className="ml-0.5 inline-block h-[1.1em] w-[0.45em] translate-y-[0.15em] animate-pulse rounded-[1px] bg-primary/80 align-baseline motion-reduce:animate-none"
        />
      ) : null}
    </div>
  );
}
