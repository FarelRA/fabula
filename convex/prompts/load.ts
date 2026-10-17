import type { Doc } from "../_generated/dataModel";
import type { TemplateMap } from "../compiler/types";
import { activeTemplateMap } from "./registry";

/** Active-template rows → the compiler's TemplateMap (PLAN §7.8). */
export function loadTemplateMap(rows: Doc<"promptTemplates">[]): TemplateMap {
  const active = activeTemplateMap(rows);
  const map: TemplateMap = {};
  for (const [key, row] of active) {
    map[key] = { key: row.key, version: row.version, content: row.content };
  }
  return map;
}
