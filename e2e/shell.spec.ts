import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

/**
 * App shell E2E (Phase 3 / Gate G3):
 *  - boots dark-first
 *  - keyboard-only walkthrough: skip link → main, "?" shortcuts, ⌘/Ctrl+K palette
 *  - responsive screenshots archived to docs/screenshots/ (320 → 2560)
 */

test.describe("app shell", () => {
  test("boots into the dark-first shell", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Fabula/);
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(
      page.getByRole("heading", { name: /Every character is AI/i }),
    ).toBeVisible();
  });

  test("keyboard-only: skip link, shortcuts dialog, command palette", async ({ page }) => {
    await page.goto("/");

    // The first tab stop is the skip link.
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();

    // Enter jumps focus into the main landmark.
    await page.keyboard.press("Enter");
    await expect(page.locator("#main")).toBeFocused();

    // "?" opens the shortcuts dialog (Appendix B).
    await page.keyboard.press("?");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Command palette")).toBeVisible();
    await expect(dialog.getByText("Pick path 1")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    // Ctrl+K opens the command palette; filtering works; Escape closes.
    await page.keyboard.press("Control+k");
    const paletteInput = page.getByPlaceholder("Type a command or search…");
    await expect(paletteInput).toBeVisible();
    await page.keyboard.type("theme");
    await expect(page.getByText("Dark theme")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(paletteInput).toBeHidden();
  });

  test("responsive screenshots 320 → 2560 (Gate G3 evidence)", async ({ page }) => {
    mkdirSync("docs/screenshots", { recursive: true });
    for (const width of [320, 768, 1280, 2560]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      await expect(
        page.getByRole("heading", { name: /Every character is AI/i }),
      ).toBeVisible();
      await page.screenshot({
        path: `docs/screenshots/shell-${width}.png`,
        fullPage: true,
      });
    }
  });
});
