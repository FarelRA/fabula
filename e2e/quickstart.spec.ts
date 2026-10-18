import { expect, test, type Page } from "@playwright/test";

/**
 * E2E-01 (PLAN §11.5): quick start reaches a rendered opening beat in ≤ 3
 * navigations, and the audition is fully keyboard-operable. Runs against the
 * isolated self-hosted Convex backend + deterministic fake model.
 */

const PREMISE =
  "A debt collector knocks on the wrong door in 1970s Saigon.";

async function quickStartToAudition(page: Page): Promise<void> {
  await page.goto("/new/quick");
  await page.getByLabel("Premise").fill(PREMISE);
  await page.getByRole("button", { name: /Cast & play/ }).click();
  await expect(page.getByText("Audition", { exact: true })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByRole("textbox", { name: "Opening beat" })).not.toHaveValue(
    "",
    { timeout: 30_000 },
  );
}

async function startScene(page: Page): Promise<void> {
  await page.getByRole("button", { name: /Start scene/ }).click();
  await expect(page).toHaveURL(/\/s\/[a-z0-9]+/i, { timeout: 30_000 });
  await expect(page.getByText(/Burst/)).toBeVisible({ timeout: 30_000 });
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

    await startScene(page);
    await expect(page.getByTestId("beat-row").first()).toBeVisible();
    await expect(page.getByTestId("beat-scroll")).toBeVisible();

    // The opener is visible in the live thread.
    await expect(
      page.getByTestId("beat-row").filter({ hasText: text.trim().slice(0, 30) }),
    ).toBeVisible({ timeout: 30_000 });

    expect(navigations).toBeLessThanOrEqual(3);
  });

  test("audition is keyboard-operable: locks, samples, start", async ({ page }, testInfo) => {
    await quickStartToAudition(page);

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
    await expect(
      page.getByRole("button", { name: `Regenerate Hook for ${roleName}` }),
    ).toBeDisabled();

    // Sample-line sheet opens with Enter, is a dialog, closes with Escape.
    const sample = page.getByRole("button", { name: /^Hear .+ voice$/ }).first();
    await sample.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    // Evidence: audition + live play at desktop and phone widths.
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

    await startScene(page);
    await expect(page.getByTestId("option-card").first()).toBeVisible({
      timeout: 30_000,
    });

    if (testInfo.project.name === "chromium-desktop") {
      await page.screenshot({
        path: "docs/screenshots/play-1280.png",
        fullPage: true,
      });
      await page.setViewportSize({ width: 375, height: 900 });
      await page.screenshot({
        path: "docs/screenshots/play-375.png",
        fullPage: true,
      });
    }
  });
});
