import { expect, test } from "@playwright/test";

// Owner rule (12 Nov 2026): ads must never appear back to back. Between any two visible ad
// slots there must be real page content, and phones never get more than 3 ads on a page.
const PAGES = ["/", "/image-compressor/", "/pdf-merger/", "/json-formatter/", "/word-counter/", "/instagram-downloader/", "/tiktok-downloader/", "/tools/", "/category/pdf-tools/", "/category/developer-tools/", "/category/social-media-downloaders/"];

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
      expect(r.count, `${path}: ads on a desktop page`).toBeLessThanOrEqual(4);
      expect(new Set(r.units).size, `${path}: the same zone twice (${r.units.join(", ")})`).toBe(r.units.length);
      expect(r.units.filter((u) => u === "native").length, `${path}: native snippets`).toBeLessThanOrEqual(1);
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

// Ads never overlap or sit inside controls: inputs, buttons, links, the URL box, tool surfaces.
for (const [name, viewport] of [["phone", { width: 390, height: 844 }], ["desktop", { width: 1280, height: 900 }]] as const)
  test(`${name}: no ad overlaps a control, and no page scrolls sideways`, async ({ page }) => {
    await page.setViewportSize(viewport);
    for (const path of PAGES) {
      await page.goto(path);
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } scrollTo(0, 0); });
      const bad = await page.evaluate(() => {
        const ads = [...document.querySelectorAll<HTMLElement>("aside.ad-slot")].filter((e) => e.offsetParent !== null);
        const ctrls = [...document.querySelectorAll<HTMLElement>("input,button,select,textarea,a[href],.tool-surface,#downloader,[data-ytx-media-input]")].filter((e) => e.offsetParent !== null && !e.closest("aside.ad-slot"));
        const out: string[] = [];
        for (const a of ads) {
          if (a.closest(".tool-surface,#downloader,[data-ytx-media-input],form,.hero")) out.push(`${a.dataset.adUnit} inside a tool`);
          const r = a.getBoundingClientRect();
          for (const c of ctrls) {
            if (c.contains(a)) continue;
            const q = c.getBoundingClientRect();
            if (r.left < q.right && q.left < r.right && r.top < q.bottom && q.top < r.bottom) out.push(`${a.dataset.adUnit} overlaps ${c.tagName.toLowerCase()}${c.id ? "#" + c.id : ""}`);
          }
        }
        if (document.documentElement.scrollWidth > document.documentElement.clientWidth) out.push("horizontal scroll");
        return out;
      });
      expect(bad, path).toEqual([]);
    }
  });

test("listing pages: a full-width ad break between groups of tools on long lists only", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/tools/");
  const brk = page.locator(".tool-grid > .grid-break");
  await expect(brk).toHaveCount(1);
  expect(await page.locator(".tool-grid > .grid-break ~ a, .tool-grid > .grid-break ~ *").count()).toBeGreaterThan(0); // tools follow it
  expect(await brk.evaluate((e) => e.previousElementSibling && [...e.parentElement!.children].indexOf(e))).toBe(6);
  // Searching hides the break (no ad between search results).
  await page.getByRole("searchbox", { name: "Search tools" }).fill("pdf");
  await expect(brk).toHaveCount(0);
  await page.goto("/category/developer-tools/");
  await expect(page.locator(".tool-grid > .grid-break")).toHaveCount(1);
  await page.goto("/category/pdf-tools/");
  await expect(page.locator(".tool-grid > .grid-break")).toHaveCount(0); // short list: no break
});
