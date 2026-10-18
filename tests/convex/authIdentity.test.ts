import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { makeT, makeUser, defaultSettings } from "./helpers";

/**
 * Convex Auth identity shape regression (Phase 4 live smoke).
 *
 * Convex Auth issues `sub = <userId>|<sessionId>` (and Convex wraps that in
 * `tokenIdentifier = <issuer>|<userId>|<sessionId>`). The domain layer must
 * resolve the users-table id, not the authSessions id.
 */

describe("currentUserId identity parsing", () => {
  test("creates a scene owned by the user embedded in a Convex Auth subject", async () => {
    const t = makeT();
    const userId = await makeUser(t, "Live Director");
    const sessionId = "auth_session_placeholder";

    const client = t.withIdentity({
      subject: `${userId}|${sessionId}`,
      tokenIdentifier: `http://127.0.0.1:3211|${userId}|${sessionId}`,
    });

    const created = await client.mutation(api.scenes.create, {
      title: "The Glass Harbor",
      premise: "A debt collector knocks on the wrong door.",
      settings: defaultSettings(),
    });

    const scene = await t.run(
      async (ctx) => await ctx.db.get(created.sceneId),
    );
    expect(scene?.ownerId).toBe(userId);

    const mine = await client.query(api.scenes.listMine, {});
    expect(mine.map((row) => row._id)).toContain(created.sceneId);
  });

  test("still accepts bare test subjects", async () => {
    const t = makeT();
    const userId = await makeUser(t, "Bare Subject");
    const client = t.withIdentity({
      subject: userId,
      tokenIdentifier: `test|${userId}`,
    });
    const created = await client.mutation(api.scenes.create, {
      title: "Bare",
      premise: "A test scene premise.",
      settings: defaultSettings(),
    });
    const scene = await t.run(async (ctx) => await ctx.db.get(created.sceneId));
    expect(scene?.ownerId).toBe(userId);
  });
});
