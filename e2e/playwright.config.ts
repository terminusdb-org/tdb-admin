import { defineConfig } from "@playwright/test";

/**
 * Playwright config for tdb-admin E2E tests.
 *
 * Target: local TerminusDB container with tdb-admin on port 6363.
 * The dashboard is served at /dashboard/ by TDB's built-in static handler.
 *
 * Override BASE_URL env var to point at a different deployment:
 *   BASE_URL=https://deployed-app.azurecontainerapps.io/dashboard npx playwright test
 */
export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  timeout: 60_000,
  retries: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:6363/dashboard/",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
  /* Global setup/teardown for test data fixtures */
  globalSetup: "./fixtures/global-setup.ts",
  globalTeardown: "./fixtures/global-teardown.ts",
});
