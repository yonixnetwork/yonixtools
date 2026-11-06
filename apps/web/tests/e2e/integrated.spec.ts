import { expect, test } from "@playwright/test";

// Frontend build wired to the real downloader API (fake worker for the platform step).
const API = "http://localhost:8788";

test.beforeEach(async ({ page }) => {
  const goto = page.goto.bind(page);
  page.goto = async (url, opts) => {
    const r = await goto(url, opts);
    await page.locator("html[data-downloader-ready]").waitFor({ state: "attached" });
    return r;
  };
});

test("paste → formats → download job → file delivered", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByTestId("dl-status")).toHaveCount(0);
  await page.locator("#dl-url").fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  await page.getByRole("button", { name: "Download", exact: true }).click();
  const card = page.locator(".media-result");
  await expect(card.getByRole("heading", { name: "Test clip" })).toBeVisible();
  await expect(card.locator(".format-item")).toHaveCount(3);
  await expect(card.locator(".format-item").nth(1)).toContainText("720p · MP4");
  await card.locator(".format-item").nth(1).getByRole("button", { name: "Download" }).click();
  const save = card.getByRole("link", { name: "Save file" });
  await expect(save).toBeVisible({ timeout: 15_000 });
  const href = await save.getAttribute("href");
  expect(href).toMatch(new RegExp(`^${API}/v1/jobs/[A-Za-z0-9_-]{20,40}/file$`));
  const file = await request.get(href!);
  expect(file.status()).toBe(200);
  expect(file.headers()["content-type"]).toBe("video/mp4");
  expect((await file.body()).length).toBeGreaterThan(10_000);
  await expect(page.getByText("Downloading is not live yet")).toHaveCount(0);
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
  await page.locator(".format-item").first().getByRole("button", { name: "Download" }).click();
  await expect(page.locator(".notice[role=alert]")).toContainText("Download failed");
  await expect(page.locator(".notice[role=alert]")).toContainText("unavailable");
  await expect(page.getByRole("link", { name: "Save file" })).toHaveCount(0);
});

test("carousel posts list every item", async ({ page }) => {
  await page.goto("/instagram-downloader/");
  await page.locator("#dl-url").fill("https://www.instagram.com/p/carousel123/");
  await page.getByRole("button", { name: "Download", exact: true }).click();
  await expect(page.locator(".media-result")).toContainText("Item 3 · image");
  await page.locator(".format-item").nth(2).getByRole("button", { name: "Download" }).click();
  await expect(page.getByRole("link", { name: "Save file" })).toBeVisible({ timeout: 15_000 });
});

test("unsafe links are rejected before any API call", async ({ page }) => {
  const apiCalls: string[] = [];
  page.on("request", (r) => r.url().startsWith(API) && apiCalls.push(r.url()));
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
  const xml = await (await request.get("/sitemap.xml")).text();
  expect(xml).toContain("https://yonixtools.com/instagram-downloader/");
});
