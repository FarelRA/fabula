import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts", "convex/tests/**/*.test.ts"],
    environment: "node",
    testTimeout: 20000,
    hookTimeout: 20000,
    server: {
      deps: {
        // These packages ship import.meta.glob (vite-transformed code); they
        // must be inlined rather than externalized by the test runner.
        inline: ["@convex-dev/agent", "convex-test"],
      },
    },
  },
});
