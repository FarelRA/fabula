import { defineConfig, devices } from "@playwright/test";

/**
 * E2E harness (PLAN §11.5). Phase 3 covers the app shell: keyboard-only
 * walkthrough and the 320px → 2560px responsive screenshots archive.
 * The fake-gateway fixtures mode arrives with the play loop (Phase 5); the
 * shell is static, so a production server is enough today.
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
        env: { PORT },
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
