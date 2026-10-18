import { expect, test, type Page } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { createLiveScene, waitForOptions } from "./helpers";

/**
 * viewer links watch the live stream read-only;
 * director links can pick path options; revocation closes the door. Guest
 * contexts carry no session at all, the token is the whole credential.
 */
test("shared viewers watch read-only; director picks; revoke closes", async ({
  page,
  browser,
}, testInfo) => {
  const sceneUrl = await createLiveScene(page);
  const sceneId = new URL(sceneUrl).pathname.split("/").pop() as Id<"scenes">;
  const owner = await ownerClient(page);

  // Stabilize the floor, then share through the real dialog.
  await page.getByRole("button", { name: /Pause auto-floor/ }).first().click();
  await expect(page.getByText(/Paused, auto-floor is off/)).toBeVisible();
  await expect
    .poll(async () => await owner.query(api.generation.runs.active, { sceneId }), {
      timeout: 20_000,
    })
    .toBeNull();
  // Fresh options at the frozen tip: cards (not ghosts) for both guests.
  const tipPath = await owner.query(api.beats.listPath, { sceneId, limit: 1000 });
  const tip = tipPath.beats[tipPath.beats.length - 1]!;
  await owner.action(api.generation.options.offer, {
    sceneId,
    parentBeatId: tip._id,
  });

  await page.getByRole("button", { name: "Share scene" }).click();
  await page.getByRole("button", { name: "Create view only link" }).click();
  await expect(page.getByTestId("share-link-row")).toHaveCount(1);

  const viewerToken = await latestToken(owner, sceneId, "viewer");
  const viewerContext = await browser.newContext();
  const viewerPage = await viewerContext.newPage();
  await viewerPage.goto(`/share/${viewerToken}`);
  await expect(viewerPage.getByText("View only").first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(viewerPage.getByTestId("beat-row").first()).toBeVisible({
    timeout: 20_000,
  });
  // Read-only: no pick buttons, no composer, no actions menu.
  await expect(
    viewerPage.getByRole("button", { name: /Take this path/ }),
  ).toHaveCount(0);
  await expect(viewerPage.getByRole("button", { name: /Actions for beat/ })).toHaveCount(0);
  await expect(viewerPage.getByText("Full text").first()).toBeVisible();
  // Presence badge appears for the guest.
  await expect(viewerPage.getByTestId("share-presence")).toBeVisible({
    timeout: 30_000,
  });
  if (testInfo.project.name === "chromium-desktop") {
    await page.screenshot({ path: "docs/screenshots/share-dialog-1280.png" });
    await viewerPage.screenshot({ path: "docs/screenshots/share-viewer-1280.png" });
  }

  // Director link: a second guest may pick.
  await page.getByRole("button", { name: "Create can direct link" }).click();
  const directorToken = await latestToken(owner, sceneId, "director");
  const directorContext = await browser.newContext();
  const directorPage = await directorContext.newPage();
  await directorPage.goto(`/share/${directorToken}`);
  await expect(directorPage.getByText("Can pick paths")).toBeVisible({
    timeout: 20_000,
  });
  await waitForOptions(directorPage);
  const optionText = (
    await directorPage
      .getByTestId("option-card")
      .first()
      .getByTestId("option-text")
      .textContent()
  )?.trim();
  expect(optionText).toBeTruthy();
  await directorPage
    .getByRole("button", { name: /Take this path/ })
    .first()
    .click();
  await expect(
    directorPage.getByTestId("beat-row").filter({ hasText: optionText! }).last(),
  ).toBeVisible({ timeout: 20_000 });
  // The viewer sees the new canon beat live, without reloading.
  await expect(
    viewerPage.getByTestId("beat-row").filter({ hasText: optionText! }).last(),
  ).toBeVisible({ timeout: 20_000 });

  // Revocation closes the viewer side; the director side stays valid.
  await page.getByRole("button", { name: /Revoke View only link/ }).click();
  await expect(page.getByTestId("share-link-row")).toHaveCount(1);
  await viewerPage.reload();
  await expect(viewerPage.getByText("This link is no longer active")).toBeVisible({
    timeout: 20_000,
  });
  await directorPage.reload();
  await expect(directorPage.getByText("Can pick paths")).toBeVisible({
    timeout: 20_000,
  });

  await viewerContext.close();
  await directorContext.close();
});

async function ownerClient(page: Page): Promise<ConvexHttpClient> {
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

async function latestToken(
  owner: ConvexHttpClient,
  sceneId: Id<"scenes">,
  permission: "viewer" | "director",
): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const links = await owner.query(api.shares.listForScene, { sceneId });
    const link = links.find(
      (row) => row.permission === permission && row.revokedAt === undefined,
    );
    if (link) return link.token;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`no active ${permission} link`);
}
