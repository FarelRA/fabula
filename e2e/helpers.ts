import { expect, type Page } from "@playwright/test";

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
