import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { createLiveScene } from "./helpers";

/**
 * Wrap → archive → export (PLAN §12 Phase 7.1–7.3 / Gate G7). The wrap offer
 * only appears after ≥2 consecutive meta end-signals, never auto-archives,
 * and the exports download as files that parse cleanly (JSON) and read as
 * markdown.
 */
test("wrap offer, archive replay, and jq-grade exports", async ({ page }, testInfo) => {
  const sceneUrl = await createLiveScene(page);
  const sceneId = new URL(sceneUrl).pathname.split("/").pop() as Id<"scenes">;
  const owner = await ownerClient(page);

  // Freeze the floor, then steer two consecutive meta results toward an end.
  await page.getByRole("button", { name: /Pause auto-floor/ }).first().click();
  await expect(page.getByText(/Paused — auto-floor is off/)).toBeVisible();
  await expect
    .poll(async () => await owner.query(api.generation.runs.active, { sceneId }), {
      timeout: 20_000,
    })
    .toBeNull();

  await owner.mutation(api.beats.appendUserBeat, {
    sceneId,
    text: "This is where the story could end. [[fake:ending]]",
  });
  const first = await owner.action(api.generation.turn.start, { sceneId });
  expect(first.status).toBe("done");
  const second = await owner.action(api.generation.turn.start, { sceneId });
  expect(second.status).toBe("done");
  await expect
    .poll(async () => (await owner.query(api.scenes.get, { sceneId })).scene.endingStreak ?? 0, {
      timeout: 20_000,
    })
    .toBeGreaterThanOrEqual(2);

  // The offer is surface-only: still playing until the director confirms.
  await page.reload();
  const wrapOffer = page.getByTestId("wrap-offer");
  await expect(wrapOffer).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Paused — auto-floor is off/)).toBeVisible();
  await page.getByRole("button", { name: "Wrap scene" }).click();
  await page.getByRole("button", { name: "Wrap & archive" }).click();
  await expect(page.getByText("Scene wrapped and archived")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByTestId("archive-banner")).toBeVisible();
  await expect(wrapOffer).toHaveCount(0);

  // The wrap pass summarizes the uncovered tail server-side.
  await expect
    .poll(async () => (await owner.query(api.summaries.listForPath, { sceneId })).length, {
      timeout: 30_000,
    })
    .toBeGreaterThanOrEqual(1);

  await page.getByRole("link", { name: "Open archive" }).click();
  await expect(page).toHaveURL(/\/archive$/);
  await expect(page.getByTestId("archive-replay")).toBeVisible({ timeout: 20_000 });
  const archivedBeats = page.getByTestId("archive-beat");
  await expect(archivedBeats.first()).toBeVisible();
  expect(await archivedBeats.count()).toBeGreaterThanOrEqual(3);
  await expect(page.getByText("This scene is archived.").first()).toBeVisible();
  await expect(page.getByText(/Summaries · [1-9]/)).toBeVisible();
  await expect(page.getByTestId("branch-explorer")).toBeVisible();
  if (testInfo.project.name === "chromium-desktop") {
    await page.screenshot({ path: "docs/screenshots/archive-1280.png" });
  }

  // Export JSON — parses like `jq`, tree links intact.
  await page.getByRole("button", { name: "Export" }).click();
  const jsonWait = page.waitForEvent("download");
  await page.getByRole("button", { name: ".json" }).click();
  const jsonDownload = await jsonWait;
  const jsonPath = await jsonDownload.path();
  expect(jsonPath).toBeTruthy();
  const bundle = JSON.parse(readFileSync(jsonPath!, "utf8")) as {
    format: string;
    version: number;
    exportedAt: string;
    branches: unknown[];
    beats: Array<{ _id: string; parentBeatId?: string }>;
    facts: unknown[];
  };
  expect(bundle.format).toBe("fabula.scene");
  expect(bundle.version).toBe(1);
  expect(Number.isNaN(Date.parse(bundle.exportedAt))).toBe(false);
  expect(bundle.branches.length).toBeGreaterThanOrEqual(1);
  expect(bundle.beats.length).toBeGreaterThanOrEqual(3);
  expect(bundle.beats.some((beat) => beat.parentBeatId)).toBe(true);

  // Export markdown — opens as a readable document.
  const mdWait = page.waitForEvent("download");
  await page.getByRole("button", { name: ".md" }).click();
  const mdDownload = await mdWait;
  const markdown = readFileSync((await mdDownload.path())!, "utf8");
  expect(markdown.startsWith("# ")).toBe(true);
  expect(markdown).toContain("## Cast");
  expect(markdown).toContain("## Facts");

  // Close the modal before reaching for the page chrome behind it.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // Back on the play route the archive banner replaces the composer's purpose.
  await page.getByRole("link", { name: "Back to the scene" }).click();
  await expect(page.getByTestId("archive-banner")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("wrap-offer")).toHaveCount(0);
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
