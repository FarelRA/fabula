/**
 * Inspector surface registry. Tabs are URL state
 * (`?inspector=memory|prompts|map|usage`), so every panel is linkable.
 */

export const INSPECTOR_TABS = ["memory", "prompts", "map", "usage"] as const;
export type InspectorTab = (typeof INSPECTOR_TABS)[number];

export const INSPECTOR_TAB_LABELS: Record<InspectorTab, string> = {
  memory: "Memory",
  prompts: "Prompts",
  map: "Map",
  usage: "Usage",
};

export function isInspectorTab(value: string | null | undefined): value is InspectorTab {
  return value !== null && value !== undefined && (INSPECTOR_TABS as readonly string[]).includes(value);
}

/** Branch-compare flag. */
export function isCompareEnabled(): boolean {
  return process.env.NEXT_PUBLIC_FABULA_FF_COMPARE === "1";
}
