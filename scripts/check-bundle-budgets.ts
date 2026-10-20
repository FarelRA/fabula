import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

/**
 * Route JS budget assertion: every shipped route must
 * stay within its gzipped first-load budget. Measures the union of the route's
 * initial chunks and the shared layout chunks from the App Router build
 * manifest, the same JS the browser downloads before first paint.
 *
 * Runs after `bun run build` (wired into `bun run check:bundles` + CI).
 */

const BUDGETS: Array<{ route: string; maxKb: number }> = [
  { route: "/page", maxKb: 250 },
  { route: "/new/page", maxKb: 250 },
  { route: "/new/quick/page", maxKb: 340 },
  { route: "/new/wizard/page", maxKb: 340 },
  { route: "/new/templates/page", maxKb: 250 },
  { route: "/library/page", maxKb: 250 },
  { route: "/help/page", maxKb: 250 },
  { route: "/s/[sceneId]/page", maxKb: 250 },
  { route: "/s/[sceneId]/archive/page", maxKb: 250 },
  { route: "/share/[token]/page", maxKb: 250 },
];

const nextDir = join(process.cwd(), ".next");
const manifest = JSON.parse(
  readFileSync(join(nextDir, "app-build-manifest.json"), "utf8"),
) as { pages: Record<string, string[]> };

/** Route groups are build-time details; budgets are written as public URLs. */
const normalizeRoute = (key: string) => key.replace(/\/\([^/]+\)/g, "");

// Next's own "First Load JS" is the gzip sum of each route's manifest entry, // the chunk set every visitor downloads before first paint.
let failures = 0;
for (const { route, maxKb } of BUDGETS) {
  const manifestKey = Object.keys(manifest.pages).find(
    (key) => normalizeRoute(key) === route,
  );
  const routeChunks = manifestKey ? manifest.pages[manifestKey] : undefined;
  if (!routeChunks) {
    console.error(`OVER ${route}: missing from app-build-manifest.json`);
    failures += 1;
    continue;
  }
  const unique = new Set(routeChunks);
  let bytes = 0;
  for (const chunk of unique) {
    if (!chunk.endsWith(".js")) continue;
    bytes += gzipSync(readFileSync(join(nextDir, chunk))).length;
  }
  const kb = bytes / 1024;
  const ok = kb <= maxKb;
  if (!ok) failures += 1;
  console.log(
    `${ok ? "ok  " : "OVER"} ${route}: ${kb.toFixed(1)} kB gz (budget ${maxKb})`,
  );
}

if (failures > 0) {
  console.error(
    `Route budget check failed for ${failures} route(s). Audit the chunk growth or raise the budget with an ADR-style justification.`,
  );
  process.exit(1);
}
console.log("Route budgets OK.");
