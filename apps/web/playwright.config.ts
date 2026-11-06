import { defineConfig, devices } from "@playwright/test";

// Runs against the real static export (`npm run build` first), served the way
// production serves it. No dev server, no mocks.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:4173", trace: "off" },
  webServer: { command: "node scripts/serve-static.mjs out", port: 4173, reuseExistingServer: !process.env.CI },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /mobile\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts/ },
  ],
});
