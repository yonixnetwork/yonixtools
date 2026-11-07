import { expect, test } from "@playwright/test";

// Frontend build wired to the real downloader API (fake worker for the platform step),
// served same-origin under /api exactly like production.
const API = "/api/";

test.beforeEach(async ({ page }) => {
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
  await page.locator("#dl-url").fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
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
  expect(download.suggestedFilename()).toMatch(/^yonixtools-youtube-[A-Za-z0-9_-]{8}\.mp4$/);
  const path = await download.path();
  const { statSync } = await import("node:fs");
  expect(statSync(path!).size).toBeGreaterThan(10_000);
  // Only claimed once the browser really received the response (server cookie seen).
  await expect(card.locator(".format-item").nth(1)).toContainText("Download started");
  await expect(page.getByRole("link", { name: "Save file" })).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/); // no navigation, no intermediate page
  // History records title/quality only.
  await expect(page.locator(".dl-history summary")).toContainText("Recent downloads (1)");
  const stored = await page.evaluate(() => localStorage.getItem("ytx-history") || "");
  expect(stored).toContain("Test clip");
  expect(stored).not.toContain("youtube.com/watch");
});

test("download another video resets the form but keeps started downloads", async ({ page }) => {
  await page.goto("/");
  await page.locator("#dl-url").fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  await page.getByRole("button", { name: "Download", exact: true }).click();
  const downloads: string[] = [];
  page.on("download", (d) => downloads.push(d.url()));
  await page.locator(".format-item").first().getByRole("button", { name: /^Download/ }).click();
  await page.getByRole("button", { name: "Download another video" }).click();
  await expect(page.locator("#dl-url")).toHaveValue("");
  await expect(page.locator("#dl-url")).toBeFocused();
  await expect(page.locator(".media-result")).toHaveCount(0);
  // The transfer keeps going in the background and still starts.
  const bg = page.locator(".dl-background");
  await expect(bg).toContainText("Test clip");
  await expect(bg).toContainText(/Download started|Download requested/, { timeout: 20_000 });
  expect(downloads.length).toBe(1);
});

test("clear button empties the link field", async ({ page }) => {
  await page.goto("/");
  await page.locator("#dl-url").fill("https://www.tiktok.com/@a/video/7350000000000000000");
  await page.getByRole("button", { name: "Clear link" }).click();
  await expect(page.locator("#dl-url")).toHaveValue("");
});

test("extractor errors name the platform and never show success", async ({ page }) => {
  await page.goto("/");
  await page.locator("#dl-url").fill("https://www.youtube.com/watch?v=private123");
  await page.getByRole("button", { name: "Download", exact: true }).click();
  const alert = page.locator(".notice[role=alert]");
  await expect(alert).toContainText("YouTube extraction failed");
  await expect(alert).toContainText("private");
  await expect(page.getByRole("link", { name: "Save file" })).toHaveCount(0);
});

test("failed download job is reported", async ({ page }) => {
  await page.goto("/youtube-downloader/");
  await page.locator("#dl-url").fill("https://www.youtube.com/watch?v=failjob1234");
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
  await expect(page.locator(".media-result")).toContainText("Item 3 · image");
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 20_000 }), page.locator(".format-item").nth(2).getByRole("button", { name: /^Download/ }).click()]);
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
  await expect(page.getByText("Processed on our server · files deleted after 15 minutes")).toBeVisible();
  await expect(page.getByText("Runs in your browser · nothing uploaded")).toHaveCount(0);
  const xml = await (await request.get("/sitemap.xml")).text();
  expect(xml).toContain("https://yonixtools.com/instagram-downloader/");
});
