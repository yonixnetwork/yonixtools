import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Monetag runs ONLY inside the separate ad origin (http://localhost:4175 in tests), never in
// the site's pages. Its loaders are stubbed here: no real ad traffic.
const zones = JSON.parse(readFileSync(new URL("../../src/lib/ads/monetag.json", import.meta.url), "utf8"));
const EXACT = {
  vignette: `<script>
(function(s){
    s.dataset.zone='12218952',
    s.src='https://n6wxm.com/vignette.min.js'
})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')))
</script>`,
  inPagePush: `<script>
(function(s){
    s.dataset.zone='12218944',
    s.src='https://nap5k.com/tag.min.js'
})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')))
</script>`,
};

const OFF = process.env.NEXT_PUBLIC_MONETAG === "off";
test.beforeEach(({}, info) => test.skip(OFF && !info.title.startsWith("[off]"), "Monetag disabled in this build"));

type Req = { url: string; inPage: boolean };
const requests: Req[] = [];
const stubBody = { value: "" };
test.beforeEach(async ({ page }) => {
  requests.length = 0;
  stubBody.value = "";
  for (const host of ["https://n6wxm.com/**", "https://nap5k.com/**"])
    await page.route(host, (r) => (requests.push({ url: r.request().url(), inPage: r.request().frame() === page.mainFrame() }), r.fulfill({ contentType: "application/javascript", body: stubBody.value })));
  await page.route("https://bellnewyork.org/**", (r) => r.fulfill({ contentType: "application/javascript", body: "" }));
});

const pushSlot = (page: Page) => page.locator('aside[data-ad-unit="monetagPush"]');
const pageZoneScripts = (page: Page) => page.evaluate(() => document.querySelectorAll("script[data-zone]").length);

test("the Monetag codes are stored byte for byte", () => {
  expect(zones.vignette.snippet).toBe(EXACT.vignette);
  expect(zones.inPagePush.snippet).toBe(EXACT.inPagePush);
});

test.describe("desktop", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("allowed utility pages: In-Page Push loads once, inside the ad-origin frame, never in the page", async ({ page }) => {
    const allowed = ["/image-compressor/", "/pdf-merger/", "/json-formatter/", "/tools/", "/category/pdf-tools/"];
    for (const path of allowed) {
      await page.goto(path);
      const slot = pushSlot(page);
      await expect(slot, path).toHaveCount(1);
      await slot.scrollIntoViewIfNeeded();
      const frame = slot.locator("iframe");
      await expect(frame, path).toHaveAttribute("src", /^http:\/\/localhost:4175\/ad-frame\.html\?u=monetagPush&s=/);
      await expect.poll(() => requests.filter((r) => r.url.includes("tag.min.js")).length, { message: path }).toBeGreaterThan(0);
      expect(await pageZoneScripts(page), path).toBe(0); // the zone's script never runs in the site's page
      requests.length = 0;
    }
  });

  test("Vignette never loads on the site (an overlay can't be isolated)", async ({ page }) => {
    for (const path of ["/image-compressor/", "/tools/", "/category/pdf-tools/"]) {
      await page.goto(path);
      for (const a of await page.locator("aside.ad-slot").all()) await a.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(1500);
    }
    expect(requests.filter((r) => r.url.includes("vignette"))).toEqual([]);
    expect(requests.filter((r) => r.inPage)).toEqual([]);
  });

  test("never on the homepage, any downloader page (with results) or the downloader category", async ({ page }) => {
    for (const path of ["/", "/social-media-downloader/", "/instagram-downloader/", "/tiktok-downloader/", "/facebook-downloader/", "/category/social-media-downloaders/"]) {
      await page.goto(path);
      for (const a of await page.locator("aside.ad-slot").all()) await a.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(1200);
      await expect(pushSlot(page), path).toHaveCount(0);
      expect(await pageZoneScripts(page), path).toBe(0);
    }
    expect(requests).toEqual([]);
  });

  test("a creative from the zone grows the slot; an empty zone collapses it", async ({ page }) => {
    stubBody.value = "var d=document.createElement('div');d.style.cssText='width:320px;height:90px;background:#ccc';d.textContent='Sponsored message from a test';document.body.appendChild(d);";
    await page.goto("/pdf-merger/");
    const slot = pushSlot(page);
    await slot.scrollIntoViewIfNeeded();
    await expect(slot).toHaveAttribute("data-ad-state", "filled", { timeout: 10_000 });
    await expect(slot.locator(".ad-label")).toBeVisible();
    stubBody.value = "";
    await page.goto("/json-formatter/");
    await pushSlot(page).scrollIntoViewIfNeeded();
    await expect(pushSlot(page)).toHaveAttribute("data-ad-state", "empty", { timeout: 20_000 });
  });

  test("downloads can't be intercepted by page-level click listeners", async ({ page }) => {
    await page.goto("/qr-code-generator/");
    await page.evaluate(() => {
      (window as unknown as { seen: string[] }).seen = [];
      for (const phase of [true, false])
        document.addEventListener("click", (e) => (e.target as Element).closest?.("a") && (window as unknown as { seen: string[] }).seen.push(String((e.target as HTMLAnchorElement).href)), phase);
    });
    await page.locator("#qr-text").fill("https://example.com");
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "SVG" }).click()]);
    expect(dl.suggestedFilename()).toMatch(/\.svg$/);
    expect(await page.evaluate(() => (window as unknown as { seen: string[] }).seen)).toEqual([]);
  });
});

test("phones: no In-Page Push on tool pages (at most two ads), but on listing pages", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/image-compressor/");
  await page.waitForTimeout(800);
  expect(await pushSlot(page).evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetParent !== null).length)).toBe(0);
  await page.goto("/tools/");
  await expect(pushSlot(page)).toHaveCount(1);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("[off] a MONETAG=off build has no Monetag slot anywhere", async ({ page }) => {
  test.skip(!OFF, "only for MONETAG=off builds");
  for (const path of ["/pdf-merger/", "/image-compressor/", "/tools/", "/category/pdf-tools/"]) {
    await page.goto(path);
    await page.waitForTimeout(800);
    await expect(pushSlot(page), path).toHaveCount(0);
  }
  expect(requests).toEqual([]);
});
