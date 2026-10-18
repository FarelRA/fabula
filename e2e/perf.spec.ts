import { expect, test } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { createLiveScene } from "./helpers";

/**
 * Thread performance evidence (PLAN §11.7 / Gate G5): a 200-beat scene must
 * stay virtualized (a small DOM window) and scroll at interactive frame rates.
 * Seeds through the authenticated Convex HTTP client, then measures rAF while
 * scrolling the thread.
 */
test("200-beat thread is virtualized and scrolls at interactive frame rates", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium-desktop",
    "Frame-rate evidence is captured on the desktop profile.",
  );

  const sceneUrl = await createLiveScene(page);
  const sceneId = new URL(sceneUrl).pathname.split("/").pop() as Id<"scenes">;
  const token = await page.evaluate(() => {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.includes("convexAuthJWT")) return localStorage.getItem(key);
    }
    return null;
  });
  expect(token).toBeTruthy();

  const client = new ConvexHttpClient("http://127.0.0.1:3210");
  client.setAuth(token!);
  await client.mutation(api.scenes.setStatus, {
    sceneId,
    status: "paused",
  });
  const roles = await client.query(api.cast.listRoles, {
    sceneId,
    includeInactive: true,
  });
  const speakerRoleId = roles[0]?._id;

  for (let index = 0; index < 200; index += 1) {
    await client.mutation(api.beats.appendUserBeat, {
      sceneId,
      text: `Archive beat ${index + 1}. The harbour keeps its own ledger, and the rain keeps falling on the wrong door.`,
      ...(speakerRoleId ? { speakerRoleId } : {}),
    });
  }

  await page.reload();
  await expect(page.getByText(/Burst/)).toBeVisible({ timeout: 30_000 });
  const rows = page.getByTestId("beat-row");
  await expect(rows.first()).toBeVisible({ timeout: 30_000 });

  const rendered = await rows.count();
  expect(rendered).toBeGreaterThan(0);
  expect(rendered).toBeLessThan(60);

  const result = await page.evaluate(async () => {
    const scroller = document.querySelector(
      '[data-testid="beat-scroll"]',
    ) as HTMLElement | null;
    if (!scroller) return { fps: 0, frames: 0 };
    const start = performance.now();
    let frames = 0;
    await new Promise<void>((resolve) => {
      const step = (now: number) => {
        scroller.scrollTop = Math.min(
          scroller.scrollHeight,
          scroller.scrollTop + 120,
        );
        frames += 1;
        if (now - start < 1500) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
    const seconds = (performance.now() - start) / 1000;
    return { fps: frames / seconds, frames };
  });

  testInfo.attach("thread-perf", {
    body: JSON.stringify({ renderedRows: rendered, ...result }, null, 2),
    contentType: "application/json",
  });
  console.log(
    `[thread-perf] rows=${rendered} frames=${result.frames} fps=${result.fps.toFixed(1)}`,
  );
  expect(result.frames).toBeGreaterThan(10);
  expect(result.fps).toBeGreaterThan(45);
});
