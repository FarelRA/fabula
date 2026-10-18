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
 * Failure isolation and the
 * offline reconnection contract.
 *
 *  - a failure before the first token creates no beat row at all;
 *  - a mid-stream failure keeps the tree, surfaces a failed row with retry,
 *    and the retry forks cleanly while the failed attempt is preserved;
 *  - going offline shows the banner, locks story mutations, and recovery
 *    re-enables them without a reload.
 */

test("fail-before-first-token leaves the tree untouched; the next turn recovers", async ({
  page,
}) => {
  const sceneId = sceneIdFromUrl(await createLiveScene(page));
  const owner = await ownerClient(page);
  await pauseAndSettle(page, owner, sceneId);

  const before = await pathBeats(owner, sceneId);
  const noteId = await owner.mutation(api.directorNotes.add, {
    sceneId,
    kind: "steer",
    text: "Something breaks upstream. [[fake:fail-before]]",
  });

  const failed = await owner.action(api.generation.turn.start, { sceneId });
  expect(failed.status).toBe("failed");

  // No beat row exists: generation failed before the first delta.
  const afterFailure = await pathBeats(owner, sceneId);
  expect(afterFailure.length).toBe(before.length);
  await expect.poll(async () => await owner.query(api.generation.runs.active, { sceneId })).toBeNull();

  // Clear the fault and prove the next turn lands normally.
  await owner.mutation(api.directorNotes.resolve, { noteId });
  const recovered = await owner.action(api.generation.turn.start, { sceneId });
  expect(recovered.status).toBe("done");
  const afterRecovery = await pathBeats(owner, sceneId);
  expect(afterRecovery.length).toBe(before.length + 1);

  await page.reload();
  await expect(page.getByTestId("beat-row").last()).toBeVisible({
    timeout: 20_000,
  });
});

test("mid-stream failure keeps the partial as a failed attempt; retry forks cleanly", async ({
  page,
}) => {
  const sceneId = sceneIdFromUrl(await createLiveScene(page));
  const owner = await ownerClient(page);
  await pauseAndSettle(page, owner, sceneId);

  const before = await pathBeats(owner, sceneId);
  const noteId = await owner.mutation(api.directorNotes.add, {
    sceneId,
    kind: "steer",
    text: "The line snaps mid-sentence. [[fake:fail-mid:3]]",
  });

  const failed = await owner.action(api.generation.turn.start, { sceneId });
  expect(failed.status).toBe("failed");

  // The failed attempt is a beat, but never canon: the path is unchanged.
  const afterFailure = await pathBeats(owner, sceneId);
  expect(afterFailure.length).toBe(before.length);
  const pending = await owner.query(api.beats.listPending, { sceneId });
  expect(pending.length).toBe(1);
  const failedBeatId = pending[0]!._id;
  expect(pending[0]!.status).toBe("failed");
  expect(pending[0]!.text.length).toBeGreaterThan(0);

  // The UI surfaces it with a retry affordance and keeps the room usable.
  await expect(page.getByText(/attempt failed/).first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText(/Partial:/).first()).toBeVisible();

  await owner.mutation(api.directorNotes.resolve, { noteId });
  await page.getByRole("button", { name: "Retry" }).first().click();

  await expect.poll(async () => (await pathBeats(owner, sceneId)).length, {
    timeout: 30_000,
  }).toBe(before.length + 1);
  const afterRetry = await pathBeats(owner, sceneId);
  expect(afterRetry[afterRetry.length - 1]!.origin).toBe("regenerate");

  // Nothing was destroyed: the failed attempt still exists off-path.
  const preserved = await owner.query(api.beats.getWithOptions, {
    beatId: failedBeatId,
  });
  expect(preserved?.beat.status).toBe("failed");
});

test("offline: the banner appears, story mutations lock, and recovery unlocks without reload", async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName === "firefox",
    "Playwright does not emulate offline mode on Firefox; the contract is covered on Chromium and WebKit.",
  );

  const sceneId = sceneIdFromUrl(await createLiveScene(page));
  const owner = await ownerClient(page);
  await pauseAndSettle(page, owner, sceneId);

  // Fresh options at the frozen tip so a pick affordance exists to lock.
  const tip = (await pathBeats(owner, sceneId)).at(-1)!;
  await owner.action(api.generation.options.offer, {
    sceneId,
    parentBeatId: tip._id,
  });
  const pickButton = page.getByRole("button", { name: /Take this path/ }).first();
  await expect(pickButton).toBeVisible({ timeout: 20_000 });

  await context.setOffline(true);
  await expect(page.getByText(/You're offline/)).toBeVisible({ timeout: 15_000 });
  await expect(pickButton).toBeDisabled();

  await context.setOffline(false);
  await expect(page.getByText(/You're offline/)).toBeHidden({ timeout: 30_000 });
  await expect(pickButton).toBeEnabled({ timeout: 30_000 });
});
