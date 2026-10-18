/**
 * Dot-path helpers for lock-aware role card edits.
 */

export function getPath(obj: Record<string, unknown>, path: string): unknown {
  let current: unknown = obj;
  for (const key of path.split(".")) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

export function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split(".");
  let current: Record<string, unknown> = obj;
  for (let index = 0; index < keys.length - 1; index += 1) {
    const key = keys[index];
    if (key === undefined) return;
    const next = current[key];
    if (next === null || typeof next !== "object" || Array.isArray(next)) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  const last = keys[keys.length - 1];
  if (last !== undefined) current[last] = value;
}

/** Copy locked paths from source onto target (locked values win). */
export function copyPaths(
  source: Record<string, unknown>,
  target: Record<string, unknown>,
  paths: string[],
): void {
  for (const path of paths) {
    const value = getPath(source, path);
    if (value !== undefined) setPath(target, path, value);
  }
}
