/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import { cn } from "cn";
import {
  avatarGradient,
  monogramFor,
  roleAccent,
} from "@/lib/cast/avatar";

/**
 * Deterministic placeholder first, avatar image crossfades in when ready
 *. The placeholder is pure CSS, so it paints with the first frame;
 * image generation never blocks the audition.
 */
export function RoleAvatar({
  name,
  monogram,
  accentColor,
  imageUrl,
  size = "md",
  className,
}: {
  name: string;
  monogram?: string;
  accentColor?: string;
  imageUrl?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const accent = roleAccent(accentColor ?? name);

  useEffect(() => {
    setLoaded(false);
  }, [imageUrl]);

  const dimensions =
    size === "sm" ? "size-10 text-sm" : size === "lg" ? "size-20 text-2xl" : "size-14 text-lg";

  return (
    <span
      aria-hidden
      style={{
        backgroundImage: avatarGradient(name, accent),
        color: `var(--role-${accent}-foreground)`,
      }}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-serif font-semibold shadow-sm ring-1 ring-black/10",
        dimensions,
        className,
      )}
    >
      <span className="pointer-events-none select-none">
        {monogram?.trim() || monogramFor(name)}
      </span>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          className={cn(
            "absolute inset-0 size-full object-cover transition-opacity duration-300 motion-reduce:transition-none",
            loaded ? "opacity-100" : "opacity-0",
          )}
          onLoad={() => setLoaded(true)}
        />
      ) : null}
    </span>
  );
}
