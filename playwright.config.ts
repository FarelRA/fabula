import { defineConfig, devices } from "@playwright/test";

/**
 * E2E harness (PLAN §11.5). Phase 5 runs against the real self-hosted Convex
 * backend with the deterministic fake model (`scripts/e2e-server.ts`) — no
 * cloud account, no provider calls. `bun run test:e2e` builds live (fixtures
 * off) and then Playwright owns the isolated backend + app.
 */

const PORT = process.env.FABULA_E2E_PORT ?? "3100";
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  reporter: [["list"]],
  use: { baseURL, trace: "on-first-retry" },
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "chromium-mobile", use: { ...devices["Pixel 7"] } },
    { name: "firefox-desktop", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit-mobile", use: { ...devices["iPhone 14"] } },
  ],
  webServer: process.env.FABULA_E2E_NO_SERVER
    ? undefined
    : {
        command: "bun run e2e:server",
        env: { PORT },
        url: baseURL,
        reuseExistingServer: false,
        timeout: 240_000,
      },
});
