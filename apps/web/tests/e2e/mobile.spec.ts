import { expect, test } from "@playwright/test";

for (const path of ["/", "/instagram-downloader/", "/image-compressor/", "/loan-calculator/", "/text-compare/", "/tools/", "/category/developer-tools/"]) {
  test(`no horizontal scroll on ${path}`, async ({ page }) => {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test("mobile menu opens with search and links", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".nav-links")).toBeHidden();
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.locator("#mobile-menu")).toBeVisible();
  await page.locator("#mobile-menu input").fill("qr");
  await expect(page.locator('#mobile-menu .suggest [role="option"]').first()).toContainText("QR");
  await expect(page.locator("#mobile-menu nav a", { hasText: "All tools" })).toBeVisible();
});

test("downloader is usable at phone width", async ({ page }) => {
  await page.goto("/");
  const input = page.locator("#dl-url");
  const box = await input.boundingBox();
  expect(box!.width).toBeGreaterThan(250);
  await input.fill("https://www.tiktok.com/@a/photo/7350000000000000001");
  await expect(page.locator("#dl-detect")).toContainText("TikTok · Photo post detected");
});
