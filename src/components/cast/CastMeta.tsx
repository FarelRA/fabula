"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "cn";
import type { StoryRole, Tier } from "@convex/shared/contracts";

const STORY_ROLE_LABELS: Record<StoryRole, string> = {
  protagonist: "Protagonist",
  antagonist: "Antagonist",
  foil: "Foil",
  wildcard: "Wildcard",
  support: "Support",
};

const TIER_LABELS: Record<Tier, string> = {
  spotlight: "Spotlight",
  supporting: "Supporting",
  background: "Background",
};

export function StoryRoleBadge({
  storyRole,
  className,
}: {
  storyRole: StoryRole;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn("gap-1 font-normal", className)}>
      {storyRole === "protagonist" ? <span aria-hidden>★</span> : null}
      {STORY_ROLE_LABELS[storyRole]}
    </Badge>
  );
}

export function TierBadge({ tier, className }: { tier: Tier; className?: string }) {
  return (
    <Badge
      variant={tier === "spotlight" ? "default" : tier === "supporting" ? "secondary" : "outline"}
      className={cn("font-normal", className)}
      title={
        tier === "background"
          ? "Speaks only when addressed or directly affected"
          : undefined
      }
    >
      {TIER_LABELS[tier]}
    </Badge>
  );
}

export function ChangedBadge({ fields }: { fields: readonly string[] }) {
  if (fields.length === 0) return null;
  return (
    <Badge
      variant="secondary"
      className="border border-primary/40 bg-primary/10 font-normal text-primary"
      title={`Changed: ${fields.join(", ")}`}
    >
      changed
    </Badge>
  );
}
