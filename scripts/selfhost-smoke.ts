import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

/**
 * Self-host smoke:
 *   backend health → template bootstrap → app responds.
 * Works against any backend URL: compose stack, Convex Cloud, or dev.
 */

const convexUrl =
  process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL ?? "http://127.0.0.1:3210";
const appUrl = process.env.FABULA_APP_URL ?? "http://127.0.0.1:3000";

async function main(): Promise<void> {
  const versionRes = await fetch(`${convexUrl}/version`);
  if (!versionRes.ok) {
    throw new Error(`Backend unhealthy at ${convexUrl}/version (${versionRes.status})`);
  }
  // The self-hosted backend answers /version with a plain-text version string
  // or JSON depending on the build; only the status code is the health signal.
  let version = "unknown";
  try {
    const body = (await versionRes.json()) as { version?: string };
    version = body.version ?? "unknown";
  } catch {
    // non-JSON body; the 200 above is the health signal
  }
  console.log(`Backend OK (${version})`);

  const client = new ConvexHttpClient(convexUrl);
  let templates = await client.query(api.prompts.seed.listActive, {});
  if (templates.length === 0) {
    await client.mutation(api.prompts.seed.seedV1, {});
    templates = await client.query(api.prompts.seed.listActive, {});
  }
  if (templates.length === 0) throw new Error("Template seeding produced no active templates");
  console.log(`Templates active: ${templates.length}`);

  const appRes = await fetch(appUrl);
  if (!appRes.ok) throw new Error(`App unhealthy at ${appUrl} (${appRes.status})`);
  console.log(`App OK (${appRes.status})`);

  console.log("Self-host smoke passed.");
}

main().catch((error: unknown) => {
  console.error("Self-host smoke FAILED:", error instanceof Error ? error.message : error);
  process.exit(1);
});
