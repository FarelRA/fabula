/**
 * Deterministic avatar placeholders. Keep this pure so it is testable without a DOM.
 */

export const ROLE_ACCENTS = [
  "amber",
  "teal",
  "violet",
  "rose",
  "sky",
  "lime",
  "orange",
  "indigo",
] as const;

export type RoleAccent = (typeof ROLE_ACCENTS)[number];

/** FNV-1a 32-bit, stable across runs, platforms and reloads. */
export function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function isRoleAccent(value: string): value is RoleAccent {
  return (ROLE_ACCENTS as readonly string[]).includes(value);
}

export function roleAccent(value: string): RoleAccent {
  if (isRoleAccent(value)) return value;
  return ROLE_ACCENTS[hashSeed(value) % ROLE_ACCENTS.length] ?? "amber";
}

export function monogramFor(name: string): string {
  const characters = Array.from(name.trim());
  const first = characters[0];
  return (first ?? "?").toLocaleUpperCase();
}

/**
 * A role's gradient is stable for its accent (the name only picks the angle),
 * so editing a name never flashes a totally new identity.
 */
export function avatarGradient(seed: string, accentColor?: string): string {
  const accent = roleAccent(accentColor ?? seed);
  const angle = 130 + (hashSeed(seed) % 70);
  return `linear-gradient(${angle}deg, var(--role-${accent}) 0%, color-mix(in oklab, var(--role-${accent}) 52%, #05060a) 100%)`;
}
