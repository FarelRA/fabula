import type { Doc } from "../_generated/dataModel";

/**
 * Prompt template registry helpers (PLAN §7.5, §7.8).
 * Pure functions over `promptTemplates` docs — the insert side lives in
 * `prompts/seed.ts`.
 */

/** FNV-1a 32-bit — provenance/dedup hash for snapshots; not cryptographic. */
export function stableHash(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/** Pick the active (else highest) version per template key. */
export function activeTemplateMap(
  templates: Doc<"promptTemplates">[],
): Map<string, Doc<"promptTemplates">> {
  const map = new Map<string, Doc<"promptTemplates">>();
  for (const template of templates) {
    const current = map.get(template.key);
    if (
      !current ||
      (template.isActive && !current.isActive) ||
      (template.isActive === current.isActive && template.version > current.version)
    ) {
      map.set(template.key, template);
    }
  }
  return map;
}

const VAR_PATTERN = /\{\{(\w+)\}\}/g;

export function renderTemplate(
  content: string,
  vars: Record<string, string | number>,
): string {
  return content.replace(VAR_PATTERN, (_match, name: string) => {
    const value = vars[name];
    return value === undefined ? `{{${name}}}` : String(value);
  });
}

export function templateVars(content: string): string[] {
  const found = new Set<string>();
  for (const match of content.matchAll(VAR_PATTERN)) {
    const name = match[1];
    if (name) found.add(name);
  }
  return [...found].sort();
}
