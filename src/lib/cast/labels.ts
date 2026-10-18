import type { Tier } from "@convex/shared/contracts";

export function tierLabel(tier: Tier): string {
  if (tier === "spotlight") return "Spotlight";
  if (tier === "supporting") return "Supporting";
  return "Background";
}
