import { expect, test } from "@playwright/test";

// Owner rule (12 Nov 2026): ads must never appear back to back. Between any two visible ad
// slots there must be real page content, and phones never get more than 3 ads on a page.
const PAGES = ["/", "/image-compressor/", "/pdf-merger/", "/json-formatter/", "/instagram-downloader/", "/tiktok-downloader/", "/tools/", "/category/pdf-tools/"];

test.beforeEach(async ({ page }) => {
  for (const h of ["https://bellnewyork.org/**", "https://n6wxm.com/**", "https://nap5k.com/**"]) await page.route(h, (r) => r.fulfill({ contentType: "application/javascript", body: "" }));
});

for (const [name, viewport] of [["phone", { width: 390, height: 844 }], ["desktop", { width: 1280, height: 900 }]] as const) {
  test(`${name}: never two ads in a row, real content between them`, async ({ page }) => {
    await page.setViewportSize(viewport);
    for (const path of PAGES) {
      await page.goto(path);
      await page.waitForTimeout(300);
      const r = await page.evaluate(() => {
        const slots = [...document.querySelectorAll<HTMLElement>("aside.ad-slot")].filter((e) => getComputedStyle(e).display !== "none" && e.offsetParent !== null);
        const gaps: number[] = [];
        for (let i = 1; i < slots.length; i++) {
          const range = document.createRange();
          range.setStartAfter(slots[i - 1]);
          range.setEndBefore(slots[i]);
          gaps.push(range.toString().replace(/Advertisement/g, "").replace(/\s+/g, " ").trim().length);
        }
        return { count: slots.length, units: slots.map((s) => s.getAttribute("data-ad-unit") || s.className), gaps };
      });
      for (const g of r.gaps) expect(g, `${path}: content between ads (${r.units.join(", ")})`).toBeGreaterThanOrEqual(80);
      if (name === "phone") expect(r.count, `${path}: ads on a phone page (${r.units.join(", ")})`).toBeLessThanOrEqual(3);
    }
  });
}

test("phones: the native unit (4 stacked tiles) is not shown", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/", "/image-compressor/", "/instagram-downloader/", "/tools/"]) {
    await page.goto(path);
    const visible = await page.locator('aside.ad-native').evaluateAll((els) => els.filter((e) => getComputedStyle(e).display !== "none").length);
    expect(visible, path).toBe(0);
  }
});
