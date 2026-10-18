import { defineConfig, devices } from "@playwright/test";

/**
 * E2E harness (PLAN §11.5). Phase 3 covers the shell; Phase 4 adds the quick
 * start (E2E-01) and the audition keyboard pass. Build with
 * `bun run build:e2e` so NEXT_PUBLIC_FIXTURES is inlined — E2E never touches
 * a backend or a model provider.
 */

const PORT = process.env.FABULA_E2E_PORT ?? "3100";
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: { baseURL, trace: "on-first-retry" },
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "chromium-mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: process.env.FABULA_E2E_NO_SERVER
    ? undefined
    : {
        command: "bun run start",
        env: { PORT, NEXT_PUBLIC_FIXTURES: "1" },
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
