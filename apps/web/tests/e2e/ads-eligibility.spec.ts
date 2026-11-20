import { readFileSync as readPolicy } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
const policy = JSON.parse(readPolicy(new URL("../../src/lib/ads/ads-policy.json", import.meta.url), "utf8")) as { version: number };

// Advertising policy, per page view (src/lib/ads/eligibility.ts): no ad frame is created before the
// eligibility answer, and anything but an explicit {eligible: true, policyVersion} means no ads.
// Runs against build:test (local test override; the test server answers "eligible" by default,
// ADS_ELIGIBILITY_STUB); each test replaces that answer with page.route. Ad networks are stubbed.
const ELIGIBILITY = "**/api/v1/ad-eligibility";

test.beforeEach(async ({ page }) => {
  for (const h of ["https://bellnewyork.org/**", "https://nap5k.com/**", "https://n6wxm.com/**"]) await page.route(h, (r) => r.fulfill({ contentType: "application/javascript", body: "" }));
  await page.setViewportSize({ width: 1280, height: 900 });
});

async function expectNoAds(page: Page, frames: string[]) {
  await page.waitForTimeout(4_000); // past the 3 s eligibility timeout
  await page.mouse.wheel(0, 4000);
  await page.waitForTimeout(500);
  expect(await page.locator("aside.ad-slot iframe, iframe[src*='ad-frame.html']").count()).toBe(0);
  expect(await page.locator("aside.ad-slot").count()).toBe(0); // dropped: no reserved space left behind
  expect(frames).toEqual([]);
}

function adFrameRequests(page: Page) {
  const frames: string[] = [];
  page.on("request", (r) => r.url().includes("/ad-frame.html") && frames.push(r.url()));
  return frames;
}

test("eligibility request fails (network error): no ad frame at all", async ({ page }) => {
  await page.route(ELIGIBILITY, (r) => r.abort("failed"));
  const frames = adFrameRequests(page);
  await page.goto("/image-compressor/");
  await expectNoAds(page, frames);
});

test("eligibility answers not eligible: no ad frame", async ({ page }) => {
  await page.route(ELIGIBILITY, (r) => r.fulfill({ json: { eligible: false, reason: "country_unknown", country: null, policyVersion: policy.version } }));
  const frames = adFrameRequests(page);
  await page.goto("/");
  await expectNoAds(page, frames);
});

test("eligibility answers for another policy version, or garbage, or an HTTP error: no ad frame", async ({ page }) => {
  for (const answer of [
    { status: 200, json: { eligible: true, reason: "eligible", country: "US", policyVersion: policy.version + 1 } },
    { status: 200, json: { eligible: "true", policyVersion: policy.version } },
    { status: 500, json: { eligible: true, policyVersion: policy.version } },
  ]) {
    await page.unroute(ELIGIBILITY);
    await page.route(ELIGIBILITY, (r) => r.fulfill(answer));
    const frames = adFrameRequests(page);
    await page.goto("/pdf-merger/");
    await expectNoAds(page, frames);
  }
});

test("eligibility does not answer within the timeout: no ad frame", async ({ page }) => {
  await page.route(ELIGIBILITY, () => { /* never answers */ });
  const frames = adFrameRequests(page);
  await page.goto("/word-counter/");
  await expectNoAds(page, frames);
});

test("eligible: asked once per page view, without cookies, BEFORE any ad frame is requested", async ({ page }) => {
  const order: string[] = [];
  let cookieHeader: string | undefined;
  await page.route(ELIGIBILITY, async (r) => {
    order.push("eligibility");
    cookieHeader = r.request().headers()["cookie"];
    await r.fulfill({ json: { eligible: true, reason: "eligible", country: "US", policyVersion: policy.version } });
  });
  page.on("request", (r) => r.url().includes("/ad-frame.html") && order.push("frame"));
  await page.context().addCookies([{ name: "ytx_probe", value: "1", url: "http://localhost:4173" }]);
  await page.goto("/image-compressor/");
  await page.locator('aside[data-ad-unit="banner300x250"]').scrollIntoViewIfNeeded();
  await expect.poll(() => order.filter((x) => x === "frame").length, { timeout: 10_000 }).toBeGreaterThan(0);
  expect(order[0]).toBe("eligibility");
  expect(order.filter((x) => x === "eligibility")).toHaveLength(1); // one answer shared by every slot
  expect(cookieHeader).toBeUndefined(); // credentials: "omit"
});
