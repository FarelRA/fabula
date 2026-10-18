import { defineApp } from "convex/server";
import agent from "@convex-dev/agent/convex.config";
import presence from "@convex-dev/presence/convex.config.js";

/**
 * Convex components. The agent component powers streaming +
 * resume: one internal thread per scene, deltas persisted and reactively
 * queried. The presence component powers shared-scene viewership badges.
 */

const app = defineApp();
app.use(agent);
app.use(presence);

export default app;
