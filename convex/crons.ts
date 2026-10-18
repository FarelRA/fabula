import { cronJobs } from "convex/server";
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * Watchdog: fail generation runs that stalled. Runs never
 * corrupt the tree, a failed run leaves at most a `failed` beat, and retry
 * happens through the normal regenerate-fork path.
 */

const STALE_AFTER_MS = 3 * 60 * 1000;

export const failStaleRuns = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const cutoff = Date.now() - STALE_AFTER_MS;
    const stale = await ctx.db
      .query("generationRuns")
      .withIndex("by_startedAt", (q) => q.lte("startedAt", cutoff))
      .collect();
    let failed = 0;
    for (const run of stale) {
      if (run.status === "running") {
        await ctx.db.patch(run._id, {
          status: "failed",
          error: "watchdog: stale run",
          finishedAt: Date.now(),
        });
        failed += 1;
      }
    }
    return failed;
  },
});

const crons = cronJobs();

crons.interval("fail stale generation runs", { minutes: 2 }, internal.crons.failStaleRuns);

export default crons;
