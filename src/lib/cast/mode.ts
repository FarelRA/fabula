/** Build-time switch: fixtures for deterministic E2E/dev, live Convex otherwise. */
export function isFixturesMode(): boolean {
  const hasBackend = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);
  return process.env.NEXT_PUBLIC_FIXTURES === "1" || !hasBackend;
}
