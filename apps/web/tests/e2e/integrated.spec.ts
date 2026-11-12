import { expect, test } from "@playwright/test";
import { blockExternal } from "./helpers";

// Frontend build wired to the real downloader API (fake worker for the platform step),
// served same-origin under /api exactly like production.
const API = "/api/";

test.beforeEach(async ({ page }) => {
  await blockExternal(page); // no ad network or other external host, in any browser
  const goto = page.goto.bind(page);
  page.goto = async (url, opts) => {
    const r = await goto(url, opts);
    await page.locator("html[data-downloader-ready]").waitFor({ state: "attached" });
    return r;
  };
});

test("one click on a quality downloads the file, with no second button", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("dl-status")).toHaveCount(0);
  await page.locator("#dl-url").fill("https://www.tiktok.com/@creator/video/7350000000000000001");
  await page.getByRole("button", { name: "Download", exact: true }).click();
  const card = page.locator(".media-result");
  await expect(card.getByRole("heading", { name: "Test clip" })).toBeVisible();
  await expect(card.locator(".format-item")).toHaveCount(3);
  await expect(card.locator(".format-item").nth(1)).toContainText("720p · MP4");
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 20_000 }),
    card.locator(".format-item").nth(1).getByRole("button", { name: /Download 720p/ }).click(),
  ]);
  expect(download.url()).toMatch(/\/api\/v1\/jobs\/[A-Za-z0-9_-]{20,40}\/file\?dl=[a-z0-9]{8,32}$/);
  expect(download.suggestedFilename()).toMatch(/^yonixtools-tiktok-[A-Za-z0-9_-]{8}\.mp4$/);
  const path = await download.path();
  const { statSync } = await import("node:fs");
  expect(statSync(path!).size).toBeGreaterThan(10_000);
  // Only claimed once the browser really received the response (server cookie seen).
  await expect(card.locator(".format-item").nth(1)).toContainText("Download started");
  await expect(page.getByRole("link", { name: "Save file" })).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/); // no navigation, no intermediate page
  // No download history is shown or stored.
  await expect(page.locator(".dl-history")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("ytx-history"))).toBeNull();
});

test("download another video resets the form but keeps started downloads", async ({ page }) => {
  await page.goto("/");
  await page.locator("#dl-url").fill("https://www.tiktok.com/@creator/video/7350000000000000002");
  await page.getByRole("button", { name: "Download", exact: true }).click();
  const downloads: string[] = [];
  page.on("download", (d) => downloads.push(d.url()));
  await page.locator(".format-item").first().getByRole("button", { name: /^Download/ }).click();
  await page.getByRole("button", { name: "Download another video" }).click();
  await expect(page.locator("#dl-url")).toHaveValue("");
  await expect(page.locator("#dl-url")).toBeFocused();
  await expect(page.locator(".media-result")).toHaveCount(0);
  // The transfer keeps going in the background and still starts (then leaves the list: no history).
  await expect.poll(() => downloads.length, { timeout: 20_000 }).toBe(1);
  await expect(page.locator(".dl-background")).toHaveCount(0, { timeout: 10_000 });
});

test("clear button empties the link field", async ({ page }) => {
  await page.goto("/");
  await page.locator("#dl-url").fill("https://www.tiktok.com/@a/video/7350000000000000000");
  await page.getByRole("button", { name: "Clear link" }).click();
  await expect(page.locator("#dl-url")).toHaveValue("");
});

test("extractor errors name the platform and never show success", async ({ page }) => {
  await page.goto("/");
  await page.locator("#dl-url").fill("https://www.facebook.com/someone/videos/private123/");
  await page.getByRole("button", { name: "Download", exact: true }).click();
  const alert = page.locator(".notice[role=alert]");
  await expect(alert).toContainText("Facebook extraction failed");
  await expect(alert).toContainText("private");
  await expect(page.getByRole("link", { name: "Save file" })).toHaveCount(0);
});

test("failed download job is reported", async ({ page }) => {
  await page.goto("/tiktok-downloader/");
  await page.locator("#dl-url").fill("https://www.tiktok.com/@creator/video/7350000000000001234?failjob=1");
  await page.getByRole("button", { name: "Download", exact: true }).click();
  await page.locator(".format-item").first().getByRole("button", { name: /^Download/ }).click();
  await expect(page.locator(".notice[role=alert]")).toContainText("Download failed");
  await expect(page.locator(".format-item").first().getByRole("button", { name: /Retry/ })).toBeVisible();
  await expect(page.getByText("Download started")).toHaveCount(0);
  await expect(page.locator(".notice[role=alert]")).toContainText("unavailable");
  await expect(page.getByRole("link", { name: "Save file" })).toHaveCount(0);
});

test("carousel posts list every item", async ({ page }) => {
  await page.goto("/instagram-downloader/");
  await page.locator("#dl-url").fill("https://www.instagram.com/p/carousel123/");
  await page.getByRole("button", { name: "Download", exact: true }).click();
  await expect(page.getByTestId("media-kind")).toHaveText("3 images");
  await expect(page.locator(".media-card")).toHaveCount(3);
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 20_000 }), page.locator(".media-card").nth(2).getByRole("button", { name: /^Download image 3/ }).click()]);
  expect(download.suggestedFilename()).toMatch(/^yonixtools-instagram-/);
});

test("unsafe links are rejected before any API call", async ({ page }) => {
  const apiCalls: string[] = [];
  page.on("request", (r) => new URL(r.url()).pathname.startsWith(API) && apiCalls.push(r.url()));
  await page.goto("/");
  await page.locator("#dl-url").fill("http://169.254.169.254/latest/meta-data/");
  await page.getByRole("button", { name: "Download", exact: true }).click();
  await expect(page.locator(".notice[role=alert]")).toContainText("can't be used");
  expect(apiCalls).toEqual([]);
});

test("downloader pages are indexable once the backend is configured", async ({ page, request }) => {
  await page.goto("/instagram-downloader/");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /^index/);
  await expect(page.locator(".badge-pending")).toHaveCount(0);
  await expect(page.getByText("Public posts only · no account needed")).toBeVisible();
  await expect(page.getByText("Runs in your browser · nothing uploaded")).toHaveCount(0);
  const xml = await (await request.get("/sitemap.xml")).text();
  expect(xml).toContain("https://yonixtools.com/instagram-downloader/");
});


test("mixed post: every item has its own preview card and download", async ({ page }) => {
  await page.goto("/");
  await page.locator("#dl-url").fill("https://www.instagram.com/p/mixedpost1/");
  await page.getByRole("button", { name: "Download", exact: true }).click();
  await expect(page.getByTestId("media-kind")).toHaveText("Mixed: 1 video, 2 images");
  const cards = page.locator(".media-card");
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0)).toHaveAttribute("data-kind", "video");
  await expect(cards.nth(1)).toHaveAttribute("data-kind", "image");
  // Real size choices only, plus optional conversion.
  await expect(cards.nth(1).getByLabel("Size for image 2").locator("option")).toHaveText(["Original · 1080×1350 · JPG", "640×800 · JPG"]);
  await cards.nth(1).getByLabel("File format for image 2").selectOption("png");
  const [png] = await Promise.all([page.waitForEvent("download", { timeout: 20_000 }), cards.nth(1).getByRole("button", { name: /^Download image 2/ }).click()]);
  expect(png.suggestedFilename()).toMatch(/\.png$/);
  await expect(cards.nth(1)).toContainText(/Download started|Download requested/);
});

test("select several items and download them as one ZIP", async ({ page }) => {
  await page.goto("/");
  await page.locator("#dl-url").fill("https://www.instagram.com/p/mixedpost1/");
  await page.getByRole("button", { name: "Download", exact: true }).click();
  const zipBtn = page.getByRole("button", { name: /Download selected as ZIP/ });
  await expect(zipBtn).toBeDisabled();
  await page.getByLabel("Select image 2").check();
  await page.getByLabel("Select image 3").check();
  await expect(zipBtn).toHaveText(/ZIP \(2\)/);
  const [zip] = await Promise.all([page.waitForEvent("download", { timeout: 20_000 }), zipBtn.click()]);
  expect(zip.suggestedFilename()).toMatch(/^yonixtools-instagram-[\w-]{8}\.zip$/);
  await page.getByRole("button", { name: "Select all" }).click();
  await expect(page.locator(".media-card.is-selected")).toHaveCount(3);
});

test("Reddit and Vimeo links are refused with the reason, without calling the API", async ({ page }) => {
  const apiCalls: string[] = [];
  page.on("request", (r) => new URL(r.url()).pathname.startsWith(API) && apiCalls.push(r.url()));
  await page.goto("/");
  await page.locator("#dl-url").fill("https://www.reddit.com/r/videos/comments/abc123/x/");
  await page.getByRole("button", { name: "Download", exact: true }).click();
  await expect(page.locator(".notice[role=alert]")).toContainText("Reddit downloads aren't available");
  expect(apiCalls).toEqual([]);
});

// ── Download panel (owner request 12 Nov 2026): progress while the file is prepared, one
//    labelled ad, Cancel / Hide; the download never waits for the ad. ─────────────────────
const AD_300 = "https://bellnewyork.org/22/620b3190e30ed523091b51770aea0b40";
const creative = `document.write('<a href="https://example.com"><img width="300" height="250" src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22250%22/%3E"></a>')`;

test("download panel: progress while preparing, a labelled ad, then 'Download started' until closed", async ({ page }) => {
  await page.route(AD_300, (r) => r.fulfill({ contentType: "application/javascript", body: creative }));
  await page.goto("/tiktok-downloader/");
  await page.locator("#dl-url").fill("https://www.tiktok.com/@creator/video/7350000000000000101");
  await page.getByRole("button", { name: "Download", exact: true }).click();
  const card = page.locator(".media-result");
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 20_000 }),
    card.locator(".format-item").nth(1).getByRole("button", { name: /Download 720p/ }).click(),
  ]);
  const panel = page.getByTestId("download-panel");
  await expect(panel).toBeVisible();
  expect(download.suggestedFilename()).toMatch(/\.mp4$/);
  await expect(panel).toHaveAttribute("data-phase", /started|requested/, { timeout: 20_000 });
  await expect(panel).toContainText("Download started");
  const ad = panel.locator('aside[data-ad-unit="banner300x250"]');
  await expect(ad).toHaveAttribute("data-ad-state", "filled", { timeout: 10_000 });
  await expect(ad.locator(".ad-label")).toHaveText("Advertisement");
  await page.waitForTimeout(1500);
  await expect(panel).toBeVisible(); // stays until the visitor closes it
  await panel.getByRole("button", { name: "Close", exact: true }).click();
  await expect(panel).toHaveCount(0);
});

test("download panel: the download never waits for the ad (ad script hangs)", async ({ page }) => {
  await page.route(AD_300, () => { /* never answers */ });
  await page.goto("/tiktok-downloader/");
  await page.locator("#dl-url").fill("https://www.tiktok.com/@creator/video/7350000000000000102");
  await page.getByRole("button", { name: "Download", exact: true }).click();
  const t0 = Date.now();
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 15_000 }),
    page.locator(".media-result .format-item").nth(1).getByRole("button", { name: /Download 720p/ }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.mp4$/);
  expect(Date.now() - t0).toBeLessThan(10_000);
});

test("download panel: Cancel stops a download that is still being prepared; no file is saved", async ({ page }) => {
  let downloads = 0;
  page.on("download", () => downloads++);
  await page.goto("/tiktok-downloader/");
  await page.locator("#dl-url").fill("https://www.tiktok.com/@creator/video/7350000000000000103?slowjob");
  await page.getByRole("button", { name: "Download", exact: true }).click();
  const item = page.locator(".media-result .format-item").nth(1);
  await item.getByRole("button", { name: /Download 720p/ }).click();
  const panel = page.getByTestId("download-panel");
  await expect(panel).toContainText("Preparing your download");
  await panel.getByRole("button", { name: "Cancel download" }).click();
  await expect(panel).toContainText("Download cancelled");
  await page.waitForTimeout(3000);
  expect(downloads).toBe(0);
  await panel.getByRole("button", { name: "Close", exact: true }).click();
  await expect(item.getByRole("button", { name: /Download 720p/ })).toBeEnabled(); // can start again
});

test("download panel: Hide keeps the download going", async ({ page }) => {
  await page.goto("/tiktok-downloader/");
  await page.locator("#dl-url").fill("https://www.tiktok.com/@creator/video/7350000000000000104");
  await page.getByRole("button", { name: "Download", exact: true }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 20_000 }),
    (async () => {
      await page.locator(".media-result .format-item").nth(1).getByRole("button", { name: /Download 720p/ }).click();
      await page.getByTestId("download-panel").getByRole("button", { name: /^(Hide|Close)$/ }).click();
    })(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.mp4$/);
  await expect(page.getByTestId("download-panel")).toHaveCount(0);
});
