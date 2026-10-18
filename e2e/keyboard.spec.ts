import { expect, test } from "@playwright/test";
import { api } from "../convex/_generated/api";
import {
  createLiveScene,
  ownerClient,
  pathBeats,
  pauseAndSettle,
  sceneIdFromUrl,
} from "./helpers";

/**
 * E2E-09 (PLAN §11.5 / Appendix B): the play loop is fully keyboard-operable
 * — ⌥1–4 picks, ⌘Z undo, ⌘I inspector, ⌘B map (desktop panes), ⌘J jump to
 * latest, ⌘. abort. The palette/shortcuts dialog half of E2E-09 lives in
 * shell.spec.ts (⌘K filters, ? lists bindings).
 *
 * The inspector/map half asserts the inline desktop panes; on phones the same
 * keybindings set the tab and the sheet opens from the header — the mobile
 * sheet flow is covered by E2E-08's responsive screenshots and component
 * tests, so those two assertions are desktop-scoped here.
 */

test("E2E-09 · keyboard walkthrough: pick, undo, inspector, map, jump, abort", async ({
  page,
}, testInfo) => {
  const desktop = testInfo.project.name.includes("desktop");
  const sceneId = sceneIdFromUrl(await createLiveScene(page));
  const owner = await ownerClient(page);
  await pauseAndSettle(page, owner, sceneId);

  // Fresh options at the frozen tip so ⌥1 has something to take. Wait for the
  // offer run to clear so the pick isn't swallowed by an in-flight run.
  const tip = (await pathBeats(owner, sceneId)).at(-1)!;
  await owner.action(api.generation.options.offer, {
    sceneId,
    parentBeatId: tip._id,
  });
  await expect(page.getByTestId("option-card").first()).toBeVisible({
    timeout: 20_000,
  });
  await expect
    .poll(
      async () => await owner.query(api.generation.runs.active, { sceneId }),
      { timeout: 20_000 },
    )
    .toBeNull();

  // ⌥1 → first path becomes canon without touching the mouse.
  await page.keyboard.press("Alt+1");
  await expect
    .poll(
      async () =>
        (await owner.query(api.scenes.get, { sceneId })).scene
          .activeTipBeatId,
      { timeout: 30_000 },
    )
    .not.toBe(tip._id);

  // ⌘Z → the pick is undone; the tip returns to the decision point.
  await page.keyboard.press("Control+z");
  await expect
    .poll(
      async () =>
        (await owner.query(api.scenes.get, { sceneId })).scene
          .activeTipBeatId,
      { timeout: 30_000 },
    )
    .toBe(tip._id);

  if (desktop) {
    // ⌘I → the inspector pane opens.
    await page.keyboard.press("Control+i");
    await expect(page.getByRole("tab", { name: "Memory" })).toBeVisible({
      timeout: 15_000,
    });

    // ⌘B → the story map opens (lazy chunk arrives on demand).
    await page.keyboard.press("Control+b");
    await expect(page.locator("[data-fabula-map]")).toBeVisible({
      timeout: 30_000,
    });
    await page.keyboard.press("Control+i");
  }

  // ⌘J → jump back to the newest beat after scrolling away.
  for (let index = 0; index < 14; index += 1) {
    await owner.mutation(api.beats.appendUserBeat, {
      sceneId,
      text: `Ledger line ${index + 1}: the rain keeps its own accounts on the windows.`,
    });
  }
  await expect(page.getByTestId("beat-row").last()).toBeVisible({
    timeout: 20_000,
  });
  // Let autoscroll effects settle, then scroll up (wheel on desktop engines,
  // programmatic on mobile WebKit where wheel input is unsupported). Retry:
  // a late autoscroll can re-stick to the bottom after our first attempt.
  await page.waitForTimeout(400);
  const scroller = page.getByTestId("beat-scroll");
  const jumpPill = page.getByRole("button", { name: /Jump to latest/ });
  await expect
    .poll(
      async () => {
        if (await jumpPill.isVisible().catch(() => false)) return true;
        if (testInfo.project.name.includes("mobile")) {
          await scroller.evaluate((element) => {
            element.scrollTop = 0;
          });
        } else {
          const box = await scroller.boundingBox();
          if (box) {
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.mouse.wheel(0, -20_000);
          }
        }
        return await jumpPill.isVisible().catch(() => false);
      },
      { timeout: 20_000 },
    )
    .toBe(true);
  await page.keyboard.press("Control+j");
  await expect(jumpPill).toBeHidden({ timeout: 15_000 });

  // ⌘. → abort mid-stream; the partial stays per abortedKeepsPartial (§8.5).
  // 16 chunks at 250 ms gives slow engines ample window to land the abort.
  const noteId = await owner.mutation(api.directorNotes.add, {
    sceneId,
    kind: "steer",
    text: "Take it slowly. [[fake:delay:250]] [[fake:chunks:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen]]",
  });
  const pendingTurn = owner.action(api.generation.turn.start, { sceneId });
  await expect
    .poll(
      async () => await owner.query(api.generation.runs.active, { sceneId }),
      { timeout: 20_000 },
    )
    .not.toBeNull();
  await expect(page.getByText(/is speaking/).first()).toBeVisible({
    timeout: 15_000,
  });
  await page.keyboard.press("Control+Period");
  await pendingTurn;
  await owner.mutation(api.directorNotes.resolve, { noteId });
  await expect
    .poll(
      async () => await owner.query(api.generation.runs.active, { sceneId }),
      { timeout: 20_000 },
    )
    .toBeNull();

  const beats = await pathBeats(owner, sceneId);
  const last = beats.at(-1)!;
  const words = last.text.trim().split(/\s+/).filter(Boolean);
  expect(words.length).toBeGreaterThan(0);
  // Strictly fewer than all 16 chunks: the abort cut the stream short.
  expect(words.length).toBeLessThan(16);
});
