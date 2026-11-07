import { expect, test } from "@playwright/test";

for (const path of ["/", "/instagram-downloader/", "/image-compressor/", "/loan-calculator/", "/text-compare/", "/tools/", "/category/developer-tools/"]) {
  test(`no horizontal scroll on ${path}`, async ({ page }) => {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test("hamburger opens the tools drawer with search and categories", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".nav-links")).toBeHidden();
  await page.getByRole("button", { name: "Open menu" }).click();
  const drawer = page.locator("#tools-drawer");
  await expect(drawer).toBeVisible();
  await drawer.locator("input").fill("qr");
  await expect(drawer.locator('.suggest [role="option"]').first()).toContainText("QR");
  await expect(drawer.locator(".drawer-cat")).toHaveCount(11);
  await drawer.locator("summary", { hasText: "Converters" }).click();
  await drawer.getByRole("link", { name: "Color Converter" }).click();
  await expect(page).toHaveURL(/\/color-converter\/$/);
});

test("one navigation system: the drawer (no bottom bar)", async ({ page }) => {
  await page.goto("/image-compressor/");
  await expect(page.locator(".bottom-nav")).toHaveCount(0);
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.locator("#tools-drawer .drawer-heading")).toHaveText("Tool categories");
  await page.getByRole("button", { name: "Close menu" }).click();
  await expect(page.locator("#tools-drawer")).toHaveCount(0);
});

test("downloader is above the fold on a phone", async ({ page }) => {
  await page.goto("/");
  const vh = page.viewportSize()!.height;
  const submit = await page.getByRole("button", { name: "Download", exact: true }).boundingBox();
  expect(submit!.y + submit!.height).toBeLessThan(vh);
});

test("downloader is usable at phone width", async ({ page }) => {
  await page.goto("/");
  const input = page.locator("#dl-url");
  const box = await input.boundingBox();
  expect(box!.width).toBeGreaterThan(250);
  await input.fill("https://www.tiktok.com/@a/photo/7350000000000000001");
  await expect(page.locator("#dl-detect")).toContainText("TikTok · Photo post detected");
});
