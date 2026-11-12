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

// Administrator setting MONETAG, default OFF (the production release). Tests marked "[on]" need a
// MONETAG=on build (npm run build:test:monetag, then NEXT_PUBLIC_MONETAG=on npx playwright test).
const OFF = process.env.NEXT_PUBLIC_MONETAG !== "on";
test.beforeEach(({}, info) => test.skip(OFF && info.title.startsWith("[on]"), "Monetag disabled in this build (the default)"));

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

  test("[on] allowed utility pages: In-Page Push loads once, inside the ad-origin frame, never in the page", async ({ page }) => {
    const allowed = ["/image-compressor/", "/pdf-merger/", "/json-formatter/"]; // listing pages show it on phones only (tested below)
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
      for (const y of [0.5, 1]) { await page.evaluate((f) => window.scrollTo(0, document.body.scrollHeight * f), y); await page.waitForTimeout(700); }
    }
    expect(requests.filter((r) => r.url.includes("vignette"))).toEqual([]);
    expect(requests.filter((r) => r.inPage)).toEqual([]);
  });

  test("never on the homepage, any downloader page (with results) or the downloader category", async ({ page }) => {
    for (const path of ["/", "/social-media-downloader/", "/instagram-downloader/", "/tiktok-downloader/", "/facebook-downloader/", "/category/social-media-downloaders/"]) {
      await page.goto(path);
      for (const y of [0.33, 0.66, 1]) { await page.evaluate((f) => window.scrollTo(0, document.body.scrollHeight * f), y); await page.waitForTimeout(300); }
      await expect(pushSlot(page), path).toHaveCount(0);
      expect(await pageZoneScripts(page), path).toBe(0);
    }
    expect(requests).toEqual([]);
  });

  test("[on] a creative from the zone grows the slot; an empty zone collapses it", async ({ page }) => {
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

test("[on] phones: no In-Page Push on tool or listing pages (desktop tool pages only)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/image-compressor/", "/tools/"]) {
    await page.goto(path);
    await page.waitForTimeout(800);
    expect(await pushSlot(page).evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetParent !== null).length), path).toBe(0);
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("[off] the default build (MONETAG off) never loads Monetag: no slot, no frame code, no request, on any page", async ({ page, request }) => {
  test.skip(!OFF, "only for MONETAG=off builds");
  const seen: string[] = [];
  page.on("request", (r) => /nap5k\.com|n6wxm\.com|rtmark\.net|jhnwr\.com|ldrws\.com/.test(r.url()) && seen.push(r.url()));
  for (const path of ["/", "/pdf-merger/", "/image-compressor/", "/json-formatter/", "/tools/", "/category/pdf-tools/", "/category/developer-tools/", "/instagram-downloader/", "/tiktok-downloader/"]) {
    await page.goto(path);
    for (const y of [0.33, 0.66, 1]) { await page.evaluate((f) => window.scrollTo(0, document.body.scrollHeight * f), y); await page.waitForTimeout(400); }
    await expect(pushSlot(page), path).toHaveCount(0);
    expect(await pageZoneScripts(page), path).toBe(0);
  }
  expect(seen).toEqual([]);
  expect(requests).toEqual([]);
  const frame = await (await request.get(AD + "/ad-frame.html")).text();
  expect(frame).not.toMatch(/nap5k|n6wxm|12218944|12218952/);
  // Even asking the public frame for a Monetag unit runs nothing.
  await page.goto(AD + "/ad-frame.html?u=monetagPush&s=x");
  await page.goto(AD + "/ad-frame.html?u=monetagVignette&s=x");
  await page.waitForTimeout(1000);
  expect(requests).toEqual([]);
});

// ── Admin ad test (/ad-test.html on the ad origin; its password is tested through the real nginx
//    config in admin.spec.ts). Here: what it reports, strictly. ──────────────────────────────────
const AD = "http://localhost:4175";
const panelOf = (page: Page) => page.locator("pre[data-ytx-ui]");
// Through the real nginx config the ad test needs the admin login (401 without it: admin.spec.ts).
if (process.env.REAL_NGINX && process.env.ADMIN_USER) test.use({ httpCredentials: { username: process.env.ADMIN_USER, password: process.env.ADMIN_PASS || "" } });

test("ad test: Monetag In-Page Push as a separate top-level document; rendered only with a real creative", async ({ page }) => {
  stubBody.value = "var d=document.createElement('div');d.style.cssText='width:320px;height:90px;background:#ccc';d.textContent='Sponsored message from a test';document.body.appendChild(d);";
  await page.goto(AD + "/ad-test.html?u=monetagPush");
  const p = panelOf(page);
  await expect(p).toContainText("CREATIVE RENDERED", { timeout: 10_000 });
  await expect(p).toContainText("separate top-level document on http://localhost:4175");
  await expect(p).toContainText("nap5k.com/tag.min.js loaded");
  await expect(p).toContainText("network requests:");
  if (OFF) await expect(p).toContainText("MONETAG IS DISABLED ON THE SITE (MONETAG=off). This is an administrator-only test run.");
  expect(requests.some((r) => r.url.includes("tag.min.js"))).toBe(true);
});

test("ad test: a script that loads but shows nothing is never 'rendered'", async ({ page }) => {
  stubBody.value = ""; // loads, adds nothing
  await page.goto(AD + "/ad-test.html?u=monetagVignette");
  const p = panelOf(page);
  await expect(p).toContainText("script loaded, no creative yet", { timeout: 10_000 });
  await page.waitForTimeout(3000);
  await expect(p).not.toContainText("CREATIVE RENDERED");
});

test("ad test: blocked request and failing script are told apart", async ({ page }) => {
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await page.route("https://nap5k.com/**", (r) => r.abort("blockedbyclient"));
  await page.route("https://n6wxm.com/**", (r) => r.fulfill({ contentType: "application/javascript", body: "throw new Error('zone setup failed')" }));
  await page.goto(AD + "/ad-test.html?u=monetagPush");
  await expect(panelOf(page)).toContainText("REQUEST BLOCKED", { timeout: 10_000 });
  await page.goto(AD + "/ad-test.html?u=monetagVignette");
  await expect(panelOf(page)).toContainText("SCRIPT FAILED", { timeout: 10_000 });
});

test("ad test: an Adsterra zone that returns nothing ends as NO CREATIVE RETURNED", async ({ page }) => {
  test.setTimeout(60_000);
  await page.route("https://bellnewyork.org/**", (r) => r.fulfill({ contentType: "application/javascript", body: "" }));
  await page.goto(AD + "/ad-test.html?u=banner300x250");
  await expect(panelOf(page)).toContainText("NO CREATIVE RETURNED", { timeout: 30_000 });
});

test("ad test index: every enabled format framed on the ad origin, Monetag marked disabled and not loaded", async ({ page }) => {
  await page.route("https://bellnewyork.org/**", (r) => r.fulfill({ contentType: "application/javascript", body: "" }));
  await page.goto(AD + "/ad-test.html");
  await expect(page.locator("section iframe")).toHaveCount(OFF ? 4 : 6);
  if (OFF) {
    await expect(page.locator("section", { hasText: "Monetag In-Page Push" })).toContainText("DISABLED on the site (MONETAG=off): not loaded");
    await expect(page.locator("section", { hasText: "Monetag Vignette" })).toContainText("DISABLED on the site");
    await page.waitForTimeout(1500);
    expect(requests).toEqual([]); // nothing Monetag is loaded unless the administrator opens its test
  }
  await expect(page.locator('a[href="/ad-test.html?u=monetagPush"]')).toHaveCount(1);
  await expect(page.locator('a[href="/ad-test.html?u=monetagVignette"]')).toHaveCount(1);
  await expect(page.locator("#report")).toContainText(OFF ? "Adsterra banner 300 × 250" : "Monetag In-Page Push (zone 12218944)", { timeout: 10_000 });
  await expect(page.locator("#report")).toContainText("context: inside a frame");
});

test("the public ad frame has no diagnostics and does nothing when opened directly, whatever the query", async ({ page, request }) => {
  const html = await (await request.get(AD + "/ad-frame.html")).text();
  expect(html).not.toMatch(/data-ytx-ui|__ytxReport|admin-top|ytxTest|performance\.getEntries|errors\.push/);
  stubBody.value = "";
  for (const q of ["?u=monetagPush&s=admin-top", "?u=monetagPush&s=admin-x&embed=1", "?u=monetagPush&s=x&debug=1"]) {
    await page.goto(AD + "/ad-frame.html" + q);
    await page.waitForTimeout(1200);
    expect(await page.locator("pre, [data-ytx-ui]").count(), q).toBe(0);
    expect(await page.evaluate(() => document.body.innerText.trim()), q).toBe("");
  }
});

test("the site origin never serves the ad documents", async ({ request }) => {
  for (const p of ["/ad-frame.html", "/ad-test.html", "/ad-frame.html?u=native", "/ad-test.html?u=monetagPush"]) expect((await request.get(p)).status(), p).toBe(404);
  for (const p of ["/", "/tools/", "/admin/ads/"]) expect((await request.get(AD + p)).status(), "ad origin " + p).toBe(404);
});
