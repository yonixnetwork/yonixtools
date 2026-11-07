import { defineConfig, devices } from "@playwright/test";

// Runs against the real static export (`npm run build` first), served the way
// production serves it. With E2E_INTEGRATED=1 a second build (`npm run
// build:integrated`) is tested against the real downloader API.
const integrated = process.env.E2E_INTEGRATED === "1";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:4173", trace: "off" },
  webServer: [
    { command: "node scripts/serve-static.mjs out", port: 4173, reuseExistingServer: !process.env.CI },
    ...(integrated
      ? [
          { command: "PORT=4174 API_PROXY=http://127.0.0.1:8788 node scripts/serve-static.mjs out-integrated", port: 4174, reuseExistingServer: !process.env.CI },
          { command: "bash scripts/e2e-backend.sh", url: "http://127.0.0.1:8788/readyz", reuseExistingServer: !process.env.CI, timeout: 60_000 },
        ]
      : []),
  ],
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /(mobile|integrated)\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts/ },
    ...(integrated
      ? [
          { name: "integrated", use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:4174" }, testMatch: /integrated\.spec\.ts/ },
          { name: "integrated-mobile", use: { ...devices["Pixel 7"], baseURL: "http://localhost:4174" }, testMatch: /integrated\.spec\.ts/ },
          // iOS Safari engine; CI installs WebKit (not available in every dev container).
          { name: "integrated-iphone", use: { ...devices["iPhone 15"], baseURL: "http://localhost:4174" }, testMatch: /integrated\.spec\.ts/ },
        ]
      : []),
  ],
});
