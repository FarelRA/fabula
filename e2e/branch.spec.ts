import { expect, test, type Page } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { createLiveScene, firstOptionText, waitForOptions } from "./helpers";

/**
 * E2E-04 (PLAN §11.5, Phase 6.8 · Gate G6): edit a past beat → a new branch is
 * created, the original stays intact (map shows both), the memory panel shows
 * only active-path facts, and switching back restores the original context.
 * Facts are seeded through the authenticated HTTP client so the leak
 * assertions are token-exact.
 */
test("E2E-04 · edit forks a branch; memory and map follow the active path", async ({
  page,
}, testInfo) => {
  const sceneUrl = await createLiveScene(page);
  const sceneId = new URL(sceneUrl).pathname.split("/").pop() as Id<"scenes">;
  const client = await convexClientFor(page);

  await waitForOptions(page);
  const optionText = await firstOptionText(page);
  await page.getByRole("button", { name: /Take this path/ }).first().click();
  await expect(
    page.getByTestId("beat-row").filter({ hasText: optionText }).last(),
  ).toBeVisible({ timeout: 15_000 });

  // Let the auto-burst reaction land, then pause so the path stays fixed.
  await expect
    .poll(async () => (await client.query(api.beats.listPath, { sceneId })).beats.length, {
      timeout: 30_000,
    })
    .toBeGreaterThanOrEqual(4);
  await page.getByRole("button", { name: /Pause auto-floor/ }).first().click();
  await expect(page.getByText(/Paused — auto-floor is off/)).toBeVisible();

  const pathA = await client.query(api.beats.listPath, { sceneId });
  const tipA = pathA.beats[pathA.beats.length - 1]!;
  await client.mutation(api.facts.add, {
    sceneId,
    nodeId: tipA._id,
    text: "FACT_A_9C1 the ledger is a forgery.",
  });

  // Memory shows the active-path fact.
  await page.getByRole("button", { name: "Toggle inspector" }).click();
  await page.getByRole("tab", { name: "Memory" }).click();
  await expect(page.getByText("FACT_A_9C1 the ledger is a forgery.")).toBeVisible({
    timeout: 15_000,
  });
  if (testInfo.project.name === "chromium-desktop") {
    await page.screenshot({ path: "docs/screenshots/inspector-memory-1280.png" });
  }
  // Close so the thread is interactive again on small viewports.
  await page.getByRole("button", { name: "Close inspector" }).click();

  // Edit the tip beat → L4 fork; the original branch stays.
  await page.getByRole("button", { name: `Actions for beat ${tipA.seq}` }).click();
  await page.getByRole("menuitem", { name: /Edit \(forks\)/ }).click();
  await page.getByLabel("Edited beat text").fill(
    "Edited fork: she slides the ledger back without opening it.",
  );
  await page.getByRole("button", { name: /Save & fork/ }).click();
  await expect(page.getByText(new RegExp(`Forked from beat ${tipA.seq}`))).toBeVisible({
    timeout: 15_000,
  });

  await expect
    .poll(
      async () =>
        (await client.query(api.beats.listPath, { sceneId })).beats.at(-1)?._id,
      { timeout: 20_000 },
    )
    .not.toBe(tipA._id);
  const pathB = await client.query(api.beats.listPath, { sceneId });
  const tipB = pathB.beats[pathB.beats.length - 1]!;
  expect(tipB._id).not.toBe(tipA._id);
  expect(tipB.parentBeatId).toBe(tipA.parentBeatId); // L4: forks from the parent
  await client.mutation(api.facts.add, {
    sceneId,
    nodeId: tipB._id,
    text: "FACT_B_44E the ledger is real.",
  });

  // Active path is the fork: B is in context, A is excluded (collapsed).
  await page.getByRole("button", { name: "Toggle inspector" }).click();
  await page.getByRole("tab", { name: "Memory" }).click();
  await expect(page.getByText("FACT_B_44E the ledger is real.")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("FACT_A_9C1 the ledger is a forgery.")).toHaveCount(0);

  // The map shows both branches and the preserved original beat.
  await page.getByRole("tab", { name: "Map" }).click();
  await expect(page.getByTestId("branch-map")).toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByText(/Alternate · beat \d+/).first(),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("map-node-item").filter({ hasText: `#${tipA.seq} ` })).toHaveCount(1);
  await expect(page.getByTestId("map-node-item")).toHaveCount(pathA.beats.length + 1);
  if (testInfo.project.name === "chromium-desktop") {
    await page.screenshot({ path: "docs/screenshots/branch-map-1280.png" });
  }

  // Switching back recomputes projection (L5): A returns, B never leaks.
  await page.getByRole("button", { name: "Switch" }).first().click();
  await expect(page.getByText(/Context updated/)).toBeVisible({ timeout: 10_000 });
  await page.getByRole("tab", { name: "Memory" }).click();
  await expect(page.getByText("FACT_A_9C1 the ledger is a forgery.")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("FACT_B_44E the ledger is real.")).toHaveCount(0);

  // Prompt inspector works for the selected beat (turn snapshot, 8 blocks).
  await page.getByRole("button", { name: "Close inspector" }).click();
  await page.getByRole("button", { name: `Actions for beat ${tipA.seq}` }).click();
  await page.getByRole("menuitem", { name: /Inspect prompts/ }).click();
  await expect(page.getByTestId("prompt-inspector")).toBeVisible({ timeout: 15_000 });
  // The beat links both its turn snapshot and its options batch; inspect the turn.
  await page.getByRole("button", { name: /^turn ·/ }).first().click();
  await expect
    .poll(async () => page.getByTestId("prompt-block").count(), { timeout: 15_000 })
    .toBeGreaterThanOrEqual(6);
  await expect(page.getByText(/Prompts · beat \d+/)).toBeVisible();
  await expect(page.getByText("contract.roleplay v1")).toBeVisible();

  // Usage meter reflects recorded (estimated) usage.
  await page.getByRole("tab", { name: "Usage" }).click();
  await expect(page.getByTestId("usage-meter")).toBeVisible();
  await expect(page.getByTestId("usage-meter")).toContainText("estimated");
});

async function convexClientFor(page: Page): Promise<ConvexHttpClient> {
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
