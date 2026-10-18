import { expect, test } from "@playwright/test";
import {
  createLiveScene,
  firstOptionText,
  PREMISE,
  waitForOptions,
} from "./helpers";

/**
 * Play-loop scenarios (PLAN §11.5):
 *  - E2E-02: two contexts pick-sync on the same scene.
 *  - E2E-03: reload mid-stream resumes without lost/duplicated tokens.
 *  - keyboard pick (⌥1–4) and floor mention.
 */

test("E2E-02 · a pick in one context becomes canon in another", async ({
  browser,
  page,
  baseURL,
}) => {
  const sceneUrl = await createLiveScene(page);
  await waitForOptions(page);
  const optionText = await firstOptionText(page);

  const storage = await page.context().storageState();
  const contextB = await browser.newContext({
    storageState: storage,
    baseURL: baseURL ?? "http://127.0.0.1:3100",
    viewport: { width: 1280, height: 1000 },
  });
  const pageB = await contextB.newPage();
  try {
    await pageB.goto(sceneUrl);
    await expect(pageB.getByText(/Burst/)).toBeVisible({ timeout: 30_000 });
    await waitForOptions(pageB);

    await page.getByRole("button", { name: /Take this path/ }).first().click();

    // B sees the chosen continuation without reloading.
    await expect(
      pageB.getByTestId("beat-row").filter({ hasText: optionText }),
    ).toBeVisible({ timeout: 15_000 });

    // The unpicked paths are now ghosts in both contexts (consistent forks).
    await expect(
      page.getByRole("button", { name: /unused path.*Review/i }).first(),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      pageB.getByRole("button", { name: /unused path.*Review/i }).first(),
    ).toBeVisible({ timeout: 20_000 });
  } finally {
    await contextB.close();
  }
});

test("E2E-03 · reload mid-stream resumes with no lost or duplicated tokens", async ({
  page,
}) => {
  const words = Array.from({ length: 20 }, (_, index) => `token${index + 1}`);
  const premise = `${PREMISE} [[fake:delay:180]] [[fake:chunks:${words.join("|")}]]`;
  await createLiveScene(page, premise);

  const rows = page.getByTestId("beat-row");
  await expect(rows.filter({ hasText: "token1" }).last()).toBeVisible({
    timeout: 30_000,
  });
  await expect(rows.filter({ hasText: "token5" }).last()).toBeVisible({
    timeout: 15_000,
  });

  await page.reload();
  await expect(page.getByText(/Burst/)).toBeVisible({ timeout: 30_000 });

  const finalText = words.join(" ");
  await expect(
    page.getByTestId("beat-row").filter({ hasText: finalText }),
  ).toHaveCount(1, { timeout: 30_000 });

  // Token-exact: the finalized beat carries every chunk exactly once.
  const content = await page
    .getByTestId("beat-row")
    .filter({ hasText: finalText })
    .first()
    .innerText();
  expect(content).toContain(finalText);
  expect(await page.getByTestId("beat-row").filter({ hasText: finalText }).count()).toBe(1);
});

test("keyboard pick · ⌥1 takes the first path without a modal", async ({
  page,
}) => {
  await createLiveScene(page);
  await waitForOptions(page);
  const optionText = await firstOptionText(page);

  await page.keyboard.press("Alt+1");
  await expect(
    page.getByTestId("beat-row").filter({ hasText: optionText }).last(),
  ).toBeVisible({ timeout: 15_000 });
});

test("floor mention · forcing a role makes them speak next", async ({ page }) => {
  await createLiveScene(page);
  await waitForOptions(page);

  // On phones the cast lives in a sheet; open it before using floor controls.
  const openCast = page.getByRole("button", { name: "Open cast" });
  if (await openCast.isVisible()) {
    await openCast.click();
    await expect(page.getByRole("dialog")).toBeVisible();
  }

  const trigger = page
    .getByRole("button", { name: /^Floor actions for / })
    .nth(1);
  const roleName = (await trigger.getAttribute("aria-label"))?.replace(
    "Floor actions for ",
    "",
  );
  expect(roleName).toBeTruthy();
  const escaped = roleName!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const namePattern = new RegExp(`from ${escaped}$`);
  const before = await page.getByRole("article", { name: namePattern }).count();

  await trigger.click();
  await page.getByRole("menuitem", { name: "Give floor now" }).click();
  if (await page.getByRole("dialog").isVisible()) {
    await page.keyboard.press("Escape");
  }

  await expect
    .poll(
      async () => page.getByRole("article", { name: namePattern }).count(),
      { timeout: 30_000 },
    )
    .toBeGreaterThan(before);
});

test("pause stops auto-floor; resume restarts it", async ({ page }) => {
  await createLiveScene(page, `${PREMISE} [[fake:no-decision]]`);

  // The opener is on stage and auto-burst is armed. Pause before the first
  // response lands, then wait for any already-running generation to settle.
  await page.getByRole("button", { name: /Pause auto-floor/ }).first().click();
  await expect(page.getByText(/Paused — auto-floor is off/)).toBeVisible();
  await expect(page.getByText(/speaking/)).toHaveCount(0, { timeout: 20_000 });

  const rows = page.getByTestId("beat-row");
  const before = await rows.count();
  await page.waitForTimeout(2200);
  expect(await rows.count()).toBe(before);

  await page.getByRole("button", { name: /Resume auto-floor/ }).first().click();
  await expect
    .poll(async () => rows.count(), { timeout: 20_000 })
    .toBeGreaterThan(before);
});
