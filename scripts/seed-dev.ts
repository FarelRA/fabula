import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

/**
 * Seeds the deployment's prompt templates (idempotent). Run against local
 * dev (`convex dev`) or a self-hosted backend.
 */

const url = process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL;
if (!url) {
  console.error(
    "Set NEXT_PUBLIC_CONVEX_URL (or CONVEX_URL), e.g. http://127.0.0.1:3210",
  );
  process.exit(1);
}

const client = new ConvexHttpClient(url);
const result = await client.mutation(api.prompts.seed.seedV1, {});
console.log(`Templates seeded: ${result.inserted} inserted, ${result.active} active.`);
