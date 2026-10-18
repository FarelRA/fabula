import type { RoleCard } from "@convex/shared/contracts";
import { ROLE_FIELDS, type RoleField } from "./fields";

/**
 * Diff badges after cast regeneration (PLAN §9.5: "diff badges show changed
 * cards"). Compares whole field groups, matching the lock granularity.
 */

const SERIALIZE: Record<RoleField, (card: RoleCard) => unknown> = {
  identity: (card) => card.identity,
  hook: (card) => card.hook,
  psychology: (card) => card.psychology,
  voice: (card) => card.voice,
  drives: (card) => card.drives,
  boundariesLines: (card) => card.boundariesLines,
  meta: (card) => card.meta,
};

export function changedFieldGroups(
  previous: RoleCard,
  next: RoleCard,
): RoleField[] {
  return ROLE_FIELDS.filter(
    (field) =>
      JSON.stringify(SERIALIZE[field](previous)) !==
      JSON.stringify(SERIALIZE[field](next)),
  );
}

export function changedFieldMap(
  previous: ReadonlyArray<{ id: string; card: RoleCard }>,
  next: ReadonlyArray<{ id: string; card: RoleCard }>,
): Record<string, string[]> {
  const before = new Map(previous.map((role) => [role.id, role.card]));
  const changed: Record<string, string[]> = {};
  for (const role of next) {
    const oldCard = before.get(role.id);
    if (!oldCard) continue;
    const fields = changedFieldGroups(oldCard, role.card);
    if (fields.length > 0) changed[role.id] = fields;
  }
  return changed;
}
