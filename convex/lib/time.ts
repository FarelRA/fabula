/** Wall-clock access behind a function boundary (keeps libs deterministic in tests). */
export function nowMs(): number {
  return Date.now();
}
