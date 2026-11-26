import { defineConfig, devices } from "@playwright/test";

/**
 * Critical-journey E2E tests. Requires the API on :8080 (local profile) and the web app on :3000.
 * Uses the locally installed Microsoft Edge by default so no browser download is needed;
 * set PW_CHANNEL=chromium after `npx playwright install chromium` to use bundled Chromium instead.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    ...devices["Desktop Edge"],
    channel: process.env.PW_CHANNEL ?? "msedge",
  },
  projects: [
    { name: "desktop" },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: process.env.PW_CHANNEL ?? "msedge" }, grep: /@mobile/ },
  ],
});
