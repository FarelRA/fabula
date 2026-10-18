import { query } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import {
  listUIMessages,
  syncStreams,
  vStreamArgs,
} from "@convex-dev/agent";
import { components } from "./_generated/api";
import { assertSceneAccess, assertShareLink, requireScene } from "./lib/authz";

/**
 * Streaming transport read (PLAN §2, §13.4): one Agent thread per scene.
 *
 * Beats remain the source of truth; this query exists only so the client can
 * materialize in-flight deltas (`useUIMessages(..., {stream:true})`) and resume
 * a generation after reload. Finished text always comes from the beat row, so
 * transport messages are never rendered twice.
 *
 * Share visitors pass `shareToken` instead of an identity (Phase 7.4); the
 * token is validated for this scene and reads stay open to viewers.
 */
export const listMessages = query({
  args: {
    sceneId: v.id("scenes"),
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
    streamArgs: vStreamArgs,
    shareToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const scene = await requireScene(ctx, args.sceneId);
    if (args.shareToken !== undefined) {
      await assertShareLink(ctx, args.shareToken, scene);
    } else {
      await assertSceneAccess(ctx, scene);
    }

    if (!scene.threadId || scene.threadId !== args.threadId) {
      return {
        page: [],
        isDone: true,
        continueCursor: "",
        streams: { kind: "list" as const, messages: [] },
      };
    }

    const page = await listUIMessages(ctx, components.agent, {
      threadId: scene.threadId,
      paginationOpts: args.paginationOpts,
    });
    const streams = await syncStreams(ctx, components.agent, {
      threadId: scene.threadId,
      streamArgs: args.streamArgs,
      includeStatuses: ["streaming"],
    });

    return { ...page, streams };
  },
});
