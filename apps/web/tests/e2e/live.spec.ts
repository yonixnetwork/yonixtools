import { statSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// REAL platforms, REAL worker (no fake): the full journey a visitor makes.
// Runs only with E2E_LIVE=1 (GitHub Actions "live browser" job). Samples are
// public posts from yt-dlp / gallery-dl upstream test cases.
test.describe.configure({ mode: "serial", timeout: 180_000 });

test.beforeEach(async ({ page }) => {
  const goto = page.goto.bind(page);
  page.goto = async (url, opts) => {
    const r = await goto(url, opts);
    await page.locator("html[data-downloader-ready]").waitFor({ state: "attached" });
    return r;
  };
});

async function analyse(page: Page, url: string) {
  await page.goto("/");
  await page.locator("#dl-url").fill(url);
  await page.getByRole("button", { name: "Download", exact: true }).click();
  await expect(page.locator(".dl-result")).toBeVisible({ timeout: 120_000 });
}

async function expectFile(page: Page, click: () => Promise<void>, minBytes: number, name: RegExp) {
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 150_000 }), click()]);
  expect(dl.suggestedFilename()).toMatch(name);
  const size = statSync((await dl.path())!).size;
  console.log(`LIVE ${dl.suggestedFilename()} ${size} bytes`);
  expect(size).toBeGreaterThan(minBytes);
}

test("TikTok video: one click, file saved", async ({ page }) => {
  await analyse(page, "https://www.tiktok.com/@barudakhb_/video/6984138651336838402");
  await expect(page.getByTestId("media-kind")).toHaveText("Video");
  await expectFile(page, () => page.locator(".format-item").first().getByRole("button", { name: /^Download/ }).click(), 50_000, /\.mp4$/);
  await expect(page.locator(".format-item").first()).toContainText("Download started");
});

test("Instagram reel", async ({ page }) => {
  await analyse(page, "https://www.instagram.com/reel/Chunk8-jurw/");
  await expectFile(page, () => page.locator(".format-item").first().getByRole("button", { name: /^Download/ }).click(), 100_000, /\.mp4$/);
});

test("Instagram 5-image carousel: every image, PNG conversion, ZIP", async ({ page }) => {
  await analyse(page, "https://www.instagram.com/p/BoHk1haB5tM/");
  await expect(page.getByTestId("media-kind")).toHaveText("5 images");
  const cards = page.locator(".media-card");
  await expect(cards).toHaveCount(5);
  await expect(cards.nth(0).locator("img")).toHaveJSProperty("complete", true, { timeout: 20_000 }); // preview loads same-origin
  await expectFile(page, () => cards.nth(0).getByRole("button", { name: /^Download image 1/ }).click(), 20_000, /\.jpg$/);
  await cards.nth(1).getByLabel("File format for image 2").selectOption("png");
  await expectFile(page, () => cards.nth(1).getByRole("button", { name: /^Download image 2/ }).click(), 20_000, /\.png$/);
  await page.getByLabel("Select image 3").check();
  await page.getByLabel("Select image 4").check();
  await expectFile(page, () => page.getByRole("button", { name: /Download selected as ZIP/ }).click(), 40_000, /\.zip$/);
});

test("Instagram single image", async ({ page }) => {
  await analyse(page, "https://www.instagram.com/p/BqvsDleB3lV/");
  await expect(page.getByTestId("media-kind")).toHaveText("Image");
  await expectFile(page, () => page.locator(".media-card").first().getByRole("button", { name: /^Download/ }).click(), 20_000, /\.jpg$/);
});

test("SoundCloud track as MP3", async ({ page }) => {
  await analyse(page, "https://soundcloud.com/ethmusic/lostin-powers-she-so-heavy");
  await expect(page.getByTestId("media-kind")).toHaveText("Audio");
  const mp3 = page.locator(".format-item", { hasText: "MP3" });
  await expectFile(page, () => mp3.getByRole("button", { name: /^Download/ }).click(), 200_000, /\.mp3$/);
});

test("Facebook public video", async ({ page }) => {
  await analyse(page, "https://www.facebook.com/cnn/videos/10155529876156509/");
  await expectFile(page, () => page.locator(".format-item").first().getByRole("button", { name: /^Download/ }).click(), 100_000, /\.mp4$/);
});

test("Twitch clip", async ({ page }) => {
  await analyse(page, "https://clips.twitch.tv/FaintLightGullWholeWheat");
  await expectFile(page, () => page.locator(".format-item").first().getByRole("button", { name: /^Download/ }).click(), 500_000, /\.mp4$/);
});

test("X post with several videos: cards and ZIP", async ({ page }) => {
  await analyse(page, "https://twitter.com/UltimaShadowX/status/1577719286659006464");
  await expect(page.locator(".media-card")).toHaveCount(4);
  await page.getByRole("button", { name: "Select all" }).click();
  await expectFile(page, () => page.getByRole("button", { name: /Download selected as ZIP/ }).click(), 100_000, /\.zip$/);
});

test("YouTube: honest error instead of fake qualities", async ({ page }) => {
  await page.goto("/");
  await page.locator("#dl-url").fill("https://www.youtube.com/watch?v=jNQXAC9IVRw");
  await page.getByRole("button", { name: "Download", exact: true }).click();
  // Either it works from this IP (then real qualities are listed) or the user is told why it doesn't.
  await expect(page.locator(".dl-result, .notice[role=alert]")).toBeVisible({ timeout: 120_000 });
  if (await page.locator(".notice[role=alert]").isVisible()) await expect(page.locator(".notice[role=alert]")).toContainText(/YouTube/);
  else await expect(page.locator(".format-item").first()).toContainText(/p|Best/);
});
