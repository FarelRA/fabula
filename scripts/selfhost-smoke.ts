import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

/**
 * Self-host smoke:
 *   backend health → template bootstrap → anonymous sign-in → app responds.
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

  // Auth turnstile: a fresh anonymous visitor must obtain a session. This is
  // where a deployment missing JWT_PRIVATE_KEY or JWKS fails, so smoke
  // catches it before a person does.
  const session = await client.action(api.auth.signIn, {
    provider: "anonymous",
    params: {},
  });
  const tokens = (session as { tokens?: { token?: string; refreshToken?: string } } | null)
    ?.tokens;
  if (!tokens?.token || !tokens.refreshToken) {
    throw new Error(
      `Sign-in produced no session tokens: ${JSON.stringify(session).slice(0, 200)}`,
    );
  }
  console.log("Auth OK (anonymous session issued)");

  // The app origin can sit behind a proxy or CDN; retry transient connect
  // failures before treating the app as down.
  let appStatus: number | undefined;
  let appError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const appRes = await fetch(appUrl);
      appStatus = appRes.status;
      break;
    } catch (error) {
      appError = error;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }
  }
  if (appStatus === undefined) {
    const detail = appError instanceof Error ? appError.message : String(appError);
    throw new Error(`App unreachable at ${appUrl}: ${detail}`);
  }
  if (appStatus < 200 || appStatus >= 300) {
    throw new Error(`App unhealthy at ${appUrl} (${appStatus})`);
  }
  console.log(`App OK (${appStatus})`);

  console.log("Self-host smoke passed.");
}

main().catch((error: unknown) => {
  console.error("Self-host smoke FAILED:", error instanceof Error ? error.message : error);
  process.exit(1);
});
