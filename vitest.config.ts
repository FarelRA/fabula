import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Next's tsconfig uses jsx: "preserve" (Next/SWC owns the transform there).
  // Vitest has no SWC pass, so JSX must be transformed by the test pipeline.
  // Vite 8 resolves oxc (which vitest pre-seeds), so the oxc option wins over esbuild.
  oxc: { jsx: { runtime: "automatic", importSource: "react" } },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx", "convex/tests/**/*.test.ts"],
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
