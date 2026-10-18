import { expect, type Page } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

export const PREMISE =
  "A debt collector knocks on the wrong door in 1970s Saigon.";

/** Quick start → live scene shell, returning the scene URL. */
export async function createLiveScene(
  page: Page,
  premise: string = PREMISE,
): Promise<string> {
  await page.goto("/new/quick");
  await page.getByLabel("Premise").fill(premise);
  await page.getByRole("button", { name: /Cast & play/ }).click();
  await expect(page.getByText("Audition", { exact: true })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByRole("textbox", { name: "Opening beat" })).not.toHaveValue(
    "",
    { timeout: 30_000 },
  );
  await page.getByRole("button", { name: /Start scene/ }).click({ force: true });
  await expect(page).toHaveURL(/\/s\/[a-z0-9]+/i, { timeout: 30_000 });
  await expect(page.getByText(/Burst/)).toBeVisible({ timeout: 30_000 });
  return page.url();
}

export function sceneIdFromUrl(url: string): Id<"scenes"> {
  return new URL(url).pathname.split("/").pop() as Id<"scenes">;
}

/** Authenticated Convex HTTP client bound to the page's anonymous session. */
export async function ownerClient(page: Page): Promise<ConvexHttpClient> {
  const token = await page.evaluate(() => {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.includes("convexAuthJWT")) return localStorage.getItem(key);
    }
    return null;
  });
  if (!token) throw new Error("anonymous session token missing");
  const client = new ConvexHttpClient(
    process.env.FABULA_E2E_CONVEX_URL ?? "http://127.0.0.1:3210",
  );
  client.setAuth(token);
  return client;
}

/** Pause auto-floor and wait until no generation run is in flight. */
export async function pauseAndSettle(
  page: Page,
  owner: ConvexHttpClient,
  sceneId: Id<"scenes">,
): Promise<void> {
  await page.getByRole("button", { name: /Pause auto-floor/ }).first().click();
  await expect(page.getByText(/Paused, auto-floor is off/)).toBeVisible();
  await expect
    .poll(async () => await owner.query(api.generation.runs.active, { sceneId }), {
      timeout: 20_000,
    })
    .toBeNull();
}

/** The active path's beats, root → tip. */
export async function pathBeats(owner: ConvexHttpClient, sceneId: Id<"scenes">) {
  const result = await owner.query(api.beats.listPath, { sceneId, limit: 1000 });
  return result.beats;
}

export async function waitForOptions(page: Page): Promise<void> {
  await expect(page.getByTestId("option-card").first()).toBeVisible({
    timeout: 30_000,
  });
}

export async function firstOptionText(page: Page): Promise<string> {
  const text = await page
    .getByTestId("option-card")
    .first()
    .getByTestId("option-text")
    .textContent();
  if (!text) throw new Error("option text missing");
  return text.trim();
}
