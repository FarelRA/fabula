import type { RoleCard } from "@convex/shared/contracts";
import type { CastRole, RoleCardPatch } from "./types";

/**
 * Lockable role fields (PLAN §9.5 / Phase 4.2). Group-level locks map 1:1 to
 * the backend regeneration payloads (`fieldRegen` skips locked fields;
 * `castRegen` copies locked paths from the previous card).
 */

export const ROLE_FIELDS = [
  "identity",
  "hook",
  "psychology",
  "voice",
  "drives",
  "boundariesLines",
  "meta",
] as const;

export type RoleField = (typeof ROLE_FIELDS)[number];

export const ROLE_FIELD_LABELS: Record<RoleField, string> = {
  identity: "Identity",
  hook: "Hook",
  psychology: "Personality",
  voice: "Voice",
  drives: "Goals",
  boundariesLines: "Boundaries",
  meta: "Casting",
};

export function isRoleField(value: string): value is RoleField {
  return (ROLE_FIELDS as readonly string[]).includes(value);
}

export function isLocked(role: CastRole, field: string): boolean {
  return role.draftLocks.includes(field);
}

export function toggleLock(locks: readonly string[], field: string): string[] {
  return locks.includes(field)
    ? locks.filter((lock) => lock !== field)
    : [...locks, field];
}

function cloneCard(card: RoleCard): RoleCard {
  return JSON.parse(JSON.stringify(card)) as RoleCard;
}

/**
 * Deterministic fixture counterpart of the backend `copyPaths` behaviour:
 * locked groups survive regeneration byte-identically.
 */
export function mergeRespectingLocks(
  previous: RoleCard,
  next: RoleCard,
  locks: readonly string[],
): RoleCard {
  const merged = cloneCard(next);
  for (const lock of locks) {
    if (lock === "identity") merged.identity = { ...previous.identity };
    if (lock === "hook") merged.hook = previous.hook;
    if (lock === "psychology") merged.psychology = { ...previous.psychology };
    if (lock === "voice") merged.voice = { ...previous.voice };
    if (lock === "drives") merged.drives = { ...previous.drives };
    if (lock === "boundariesLines") merged.boundariesLines = [...previous.boundariesLines];
    if (lock === "meta") merged.meta = { ...previous.meta };
  }
  return merged;
}

export function applyRolePatch(card: RoleCard, patch: RoleCardPatch): RoleCard {
  return {
    ...card,
    ...(patch.hook !== undefined ? { hook: patch.hook } : {}),
    ...(patch.psychology !== undefined ? { psychology: patch.psychology } : {}),
    ...(patch.voice !== undefined ? { voice: patch.voice } : {}),
    ...(patch.drives !== undefined ? { drives: patch.drives } : {}),
    ...(patch.boundariesLines !== undefined
      ? { boundariesLines: patch.boundariesLines }
      : {}),
    ...(patch.relations !== undefined ? { relations: patch.relations } : {}),
    ...(patch.meta !== undefined ? { meta: patch.meta } : {}),
    ...(patch.identity !== undefined
      ? { identity: { ...card.identity, ...patch.identity } }
      : {}),
  };
}
