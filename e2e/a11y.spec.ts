import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { api } from "../convex/_generated/api";
import {
  createLiveScene,
  ownerClient,
  pauseAndSettle,
  sceneIdFromUrl,
} from "./helpers";

/**
 * Accessibility half: every primary surface passes an
 * axe-core WCAG 2.2 AA sweep with zero critical/serious violations. Full
 * violation reports are attached as test artifacts.
 *
 * Axe inspects the accessibility tree, not the engine, the sweep runs once on
 * the desktop profile while the responsive sweep and the keyboard walkthrough
 * walkthrough run across the whole browser matrix.
 */

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function expectNoBlockingViolations(
  page: Page,
  label: string,
  testInfo: TestInfo,
): Promise<void> {
  // Transient toasts are legitimately short-lived; let them expire so the
  // audit sees the durable surface (toast contrast is covered by the theme
  // token tests + the idle scans).
  await page
    .waitForFunction(
      () => document.querySelectorAll("[data-sonner-toast]").length === 0,
      undefined,
      { timeout: 15_000 },
    )
    .catch(() => undefined);
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  await testInfo.attach(`axe-${label}.json`, {
    body: JSON.stringify(results.violations, null, 2),
    contentType: "application/json",
  });
  const blocking = results.violations.filter(
    (violation) =>
      violation.impact === "critical" || violation.impact === "serious",
  );
  expect(
    blocking.map(
      (violation) =>
        `${violation.id} (${violation.impact}) × ${violation.nodes.length}: ${violation.help} @ ${String(violation.nodes[0]?.target?.[0] ?? "?")}`,
    ),
  ).toEqual([]);
}

test.describe("a11y sweep (WCAG 2.2 AA)", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "The axe sweep runs once on the desktop profile.",
    );
  });

  test("onboarding surfaces: landing, doors, quick, wizard, templates", async ({
    page,
  }, testInfo) => {
    const routes = [
      ["/", "landing"],
      ["/new", "three-doors"],
      ["/new/quick", "quick"],
      ["/new/wizard", "wizard"],
      ["/new/templates", "templates"],
    ] as const;
    for (const [route, label] of routes) {
      await page.goto(route);
      await expect(page.getByRole("heading").first()).toBeVisible({
        timeout: 20_000,
      });
      await expectNoBlockingViolations(page, label, testInfo);
    }

    // Light theme keeps AA contrast on the landing surface.
    await page.goto("/");
    await page.getByRole("button", { name: "Change theme" }).click();
    await page.getByRole("menuitem", { name: "Light" }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    // The dropdown stays mounted through its close animation; scan only once
    // it is gone so the menu's own labels and the aria-hidden page cannot leak
    // into the audit.
    await expect(page.getByRole("menu")).toBeHidden();
    await expectNoBlockingViolations(page, "landing-light", testInfo);
  });

  test("play shell: idle, inspector, palette, shortcuts dialog", async ({
    page,
  }, testInfo) => {
    const sceneId = sceneIdFromUrl(await createLiveScene(page));
    const owner = await ownerClient(page);
    await pauseAndSettle(page, owner, sceneId);

    await expectNoBlockingViolations(page, "play", testInfo);

    await page.getByRole("button", { name: /Toggle inspector/ }).click();
    await expect(page.getByRole("tab", { name: "Memory" })).toBeVisible({
      timeout: 15_000,
    });
    await expectNoBlockingViolations(page, "play-inspector", testInfo);

    await page.keyboard.press("Control+k");
    await expect(
      page.getByPlaceholder("Type a command or search…"),
    ).toBeVisible();
    // Let cmdk mount its options before the audit (the listbox must not be
    // empty at scan time).
    await expect(page.getByText("Dark theme")).toBeVisible();
    await expectNoBlockingViolations(page, "play-palette", testInfo);
    await page.keyboard.press("Escape");
    await expect(
      page.getByPlaceholder("Type a command or search…"),
    ).toBeHidden();

    await page.keyboard.press("?");
    const shortcutsDialog = page
      .getByRole("dialog")
      .filter({ hasText: "Keyboard shortcuts" });
    await expect(shortcutsDialog).toBeVisible();
    await expectNoBlockingViolations(page, "play-shortcuts", testInfo);
    await page.keyboard.press("Escape");
    await expect(shortcutsDialog).toBeHidden();
  });

  test("archive replay", async ({ page }, testInfo) => {
    const sceneId = sceneIdFromUrl(await createLiveScene(page));
    const owner = await ownerClient(page);
    await pauseAndSettle(page, owner, sceneId);
    await owner.mutation(api.scenes.endScene, { sceneId });

    await page.goto(`/s/${sceneId}/archive`);
    await expect(page.getByTestId("archive-replay")).toBeVisible({
      timeout: 20_000,
    });
    await expectNoBlockingViolations(page, "archive", testInfo);
  });

  test("shared viewer", async ({ page }, testInfo) => {
    const sceneId = sceneIdFromUrl(await createLiveScene(page));
    const owner = await ownerClient(page);
    await pauseAndSettle(page, owner, sceneId);
    const { token } = await owner.mutation(api.shares.create, {
      sceneId,
      permission: "viewer",
    });

    await page.goto(`/share/${token}`);
    await expect(page.getByText("View only").first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("beat-row").first()).toBeVisible({
      timeout: 20_000,
    });
    await expectNoBlockingViolations(page, "share-viewer", testInfo);
  });
});
