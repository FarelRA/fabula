import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Bundle lazy-load assertion (PLAN §11.7 / Gate G6): the story map
 * (@xyflow/react + dagre) must never enter the play route's initial JS.
 * Runs after `bun run build`: locates the chunk carrying the map marker and
 * proves it is absent from the route manifest's initial chunk list.
 */

const nextDir = join(process.cwd(), ".next");
const manifest = JSON.parse(
  readFileSync(join(nextDir, "app-build-manifest.json"), "utf8"),
) as { pages: Record<string, string[]> };

const routeKey = "/s/[sceneId]/page";
const routeChunks = manifest.pages[routeKey] ?? [];
if (routeChunks.length === 0) {
  console.error(`No initial chunks found for ${routeKey} — did the build run?`);
  process.exit(1);
}

const marker = "data-fabula-map";

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

let markerChunk: string | null = null;
for (const file of walk(join(nextDir, "static", "chunks"))) {
  if (!file.endsWith(".js")) continue;
  if (readFileSync(file, "utf8").includes(marker)) {
    markerChunk = "/" + relative(nextDir, file).split("\\").join("/");
    break;
  }
}

if (!markerChunk) {
  console.error(
    `Map marker "${marker}" not found in any chunk — the lazy map build output is missing.`,
  );
  process.exit(1);
}

const leaked = routeChunks.filter((chunk) => {
  const content = readFileSync(join(nextDir, chunk.replace(/^\//, "")), "utf8");
  return content.includes(marker);
});

if (leaked.length > 0) {
  console.error(
    `Story map leaked into initial route chunks for ${routeKey}: ${leaked.join(", ")}`,
  );
  process.exit(1);
}

console.log(
  `Lazy map OK: ${markerChunk} loads on demand; ${routeKey} initial chunks (${routeChunks.length}) exclude it.`,
);
