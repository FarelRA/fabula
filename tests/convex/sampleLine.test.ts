// @vitest-environment edge-runtime
import { expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { makeCard, makeT, makeUser, seedScene } from "./helpers";

/**
 * Sample lines render before the scene has any beats, so the compiled prompt
 * carries no context to send as messages. The request must include its cue
 * instead: the gateways refuse empty message lists, matching the real
 * provider, so a missing cue fails here rather than streaming nothing.
 */

test("sample lines generate for a fresh scene, then serve from cache", async () => {
  const t = makeT();
  const owner = await makeUser(t);
  const { sceneId, client } = await seedScene(t, owner);
  const roleId = await client.mutation(api.cast.upsertDraftRole, {
    sceneId,
    kind: "ai",
    card: makeCard("Linh"),
  });

  const first = await client.action(api.generation.sampleLine.generate, { roleId });
  expect(first.cached).toBe(false);
  expect(first.lines.length).toBeGreaterThanOrEqual(2);

  const second = await client.action(api.generation.sampleLine.generate, { roleId });
  expect(second.cached).toBe(true);
  expect(second.lines).toEqual(first.lines);

  const forced = await client.action(api.generation.sampleLine.generate, {
    roleId,
    force: true,
  });
  expect(forced.cached).toBe(false);
});
