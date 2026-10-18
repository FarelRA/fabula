import { defineApp } from "convex/server";
import agent from "@convex-dev/agent/convex.config";
import presence from "@convex-dev/presence/convex.config.js";

/**
 * Convex components (PLAN §2, §5.2). The agent component powers streaming +
 * resume: one internal thread per scene, deltas persisted and reactively
 * queried. Phase 2 wires the per-scene thread and role calls. Phase 7 adds the
 * presence component for shared-scene viewership badges.
 */

const app = defineApp();
app.use(agent);
app.use(presence);

export default app;
