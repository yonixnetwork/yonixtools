import { defineConfig, devices } from "@playwright/test";

// Runs against the real static export (`npm run build` first), served the way
// production serves it. With E2E_INTEGRATED=1 a second build (`npm run
// build:integrated`) is tested against the real downloader API.
const integrated = process.env.E2E_INTEGRATED === "1" || process.env.E2E_LIVE === "1";
const live = process.env.E2E_LIVE === "1"; // real platforms + real worker (CI live job only)

// No automated test may reach any external server: above all, never an ad network (no
// artificial impressions). Chromium resolves every hostname except localhost to "not found";
// stubbed routes (page.route) still answer first. The live-platform suite is the only exception
// and its build has ads off (build:integrated), like the WebKit project, which can't take this flag.
// Two locks, so it holds in every environment: DNS for anything but localhost fails, and all
// non-local traffic is sent to a dead proxy port (a configured HTTP proxy would otherwise do the
// DNS lookup itself and bypass the first lock). Loopback is never proxied.
const offline = { launchOptions: { args: ["--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1", "--proxy-server=http://127.0.0.1:9", "--proxy-bypass-list=localhost;127.0.0.1"] } };

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:4173", trace: "off" },
  webServer: [
    // Site on :4173 and the separate ad origin on :4175 (npm run build:test bakes it in).
    // With REAL_NGINX=1 both ports are already served by the real nginx config (scripts/nginx-local.sh).
    { command: "node scripts/serve-static.mjs out", port: 4173, reuseExistingServer: !process.env.CI || !!process.env.REAL_NGINX },
    { command: "PORT=4175 node scripts/serve-static.mjs out", port: 4175, reuseExistingServer: !process.env.CI || !!process.env.REAL_NGINX },
    ...(integrated
      ? [
          { command: "PORT=4174 API_PROXY=http://127.0.0.1:8788 node scripts/serve-static.mjs out-integrated", port: 4174, reuseExistingServer: !process.env.CI },
          { command: live ? "LIVE=1 bash scripts/e2e-backend.sh" : "bash scripts/e2e-backend.sh", url: "http://127.0.0.1:8788/readyz", reuseExistingServer: !process.env.CI, timeout: 60_000 },
        ]
      : []),
  ],
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], ...offline }, testIgnore: /(mobile|integrated|live|pwa-ios)\.spec\.ts/ },
    // iOS Safari user agent on Chromium (WebKit itself runs in CI for the integrated suite).
    { name: "iphone-ua", use: { ...devices["iPhone 15"], browserName: "chromium", ...offline }, testMatch: /pwa-ios\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"], ...offline }, testMatch: /mobile\.spec\.ts/ },
    ...(integrated
      ? [
          ...(live
            ? [
                { name: "live-mobile", use: { ...devices["Pixel 7"], baseURL: "http://localhost:4174" }, testMatch: /live\.spec\.ts/ },
                { name: "live-desktop", use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:4174" }, testMatch: /live\.spec\.ts/ },
              ]
            : []),
          { name: "integrated", use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:4174", ...offline }, testMatch: /integrated\.spec\.ts/ },
          { name: "integrated-mobile", use: { ...devices["Pixel 7"], baseURL: "http://localhost:4174", ...offline }, testMatch: /integrated\.spec\.ts/ },
          // iOS Safari engine; CI installs WebKit (not available in every dev container).
          { name: "integrated-iphone", use: { ...devices["iPhone 15"], baseURL: "http://localhost:4174" }, testMatch: /integrated\.spec\.ts/ },
        ]
      : []),
  ],
});
