import { expect, test } from "@playwright/test";

/**
 * E2E-01 (PLAN §11.5): quick start reaches a rendered opening beat in ≤ 3
 * navigations, and the audition is fully keyboard-operable. Runs on the
 * fixtures build (`bun run build:e2e`) — deterministic, no backend, no model.
 */

const PREMISE =
  "A debt collector knocks on the wrong door in 1970s Saigon.";

async function quickStartToAudition(page: import("@playwright/test").Page) {
  await page.goto("/new/quick");
  await page.getByLabel("Premise").fill(PREMISE);
  await page.getByRole("button", { name: /Cast & play/ }).click();
  await expect(page.getByText("Audition", { exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Opening beat" })).not.toHaveValue(
    "",
  );
}

test.describe("quick start (E2E-01)", () => {
  test("premise → audition → playable opening in ≤ 3 navigations", async ({ page }) => {
    let navigations = 0;
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) navigations += 1;
    });

    await quickStartToAudition(page);

    const opening = page.getByRole("textbox", { name: "Opening beat" });
    const text = await opening.inputValue();
    expect(text.trim().length).toBeGreaterThan(20);

    await page.getByRole("button", { name: /Start scene/ }).click();
    await expect(page).toHaveURL(/\/s\/fixture_scene_/);
    await expect(page.getByText(text.trim().slice(0, 40))).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    expect(navigations).toBeLessThanOrEqual(3);
  });

  test("keyboard drag reorders the cast", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "Hardware-keyboard reorder is exercised on the desktop project.",
    );
    await quickStartToAudition(page);
    const names = page.locator("article h3");
    const before = (await names.allTextContents()).join("|");

    const handle = page.getByRole("button", { name: /^Reorder / }).first();
    await handle.focus();
    await page.keyboard.press("Space");
    await page.waitForTimeout(200);
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(200);
    await page.keyboard.press("Space");

    await expect
      .poll(async () => (await names.allTextContents()).join("|"))
      .not.toBe(before);
  });

  test("audition is keyboard-operable: locks, samples, start", async ({ page }, testInfo) => {
    await quickStartToAudition(page);

    // Evidence: audition at desktop + phone widths. Capture before interacting
    // and at scroll 0 so sticky/fixed chrome is painted where it belongs.
    if (testInfo.project.name === "chromium-desktop") {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.setViewportSize({ width: 1280, height: 1000 });
      await page.screenshot({
        path: "docs/screenshots/audition-1280.png",
        fullPage: true,
      });
      await page.setViewportSize({ width: 375, height: 900 });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: "docs/screenshots/audition-375.png",
        fullPage: true,
      });
      await page.setViewportSize({ width: 1280, height: 1000 });
      await page.evaluate(() => window.scrollTo(0, 0));
    }

    // Lock the first role's hook with the keyboard only.
    const lock = page.getByRole("button", { name: /^Lock Hook for / }).first();
    const roleName = (await lock.getAttribute("aria-label"))?.replace(
      "Lock Hook for ",
      "",
    );
    expect(roleName).toBeTruthy();
    await lock.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("button", { name: `Unlock Hook for ${roleName}` }),
    ).toHaveAttribute("aria-pressed", "true");

    // The matching regenerate control is disabled while locked.
    await expect(
      page.getByRole("button", { name: `Regenerate Hook for ${roleName}` }),
    ).toBeDisabled();

    // Sample-line sheet opens with Enter, is a dialog, closes with Escape.
    const sample = page.getByRole("button", { name: /^Hear .+ voice$/ }).first();
    await sample.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/voice$/)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    await page.getByRole("button", { name: /Start scene/ }).click();
    await expect(page).toHaveURL(/\/s\/fixture_scene_/);
    await expect(page.getByText(/Opening/)).toBeVisible();
  });
});
