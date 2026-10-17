import { defineApp } from "convex/server";
import agent from "@convex-dev/agent/convex.config";

/**
 * Convex components (PLAN §2, §5.2). The agent component powers streaming +
 * resume: one internal thread per scene, deltas persisted and reactively
 * queried. Phase 2 wires the per-scene thread and role calls.
 */

const app = defineApp();
app.use(agent);

export default app;
