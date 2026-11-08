import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const zones = JSON.parse(readFileSync(new URL("../../src/lib/ads/monetag.json", import.meta.url), "utf8"));

// The two Monetag codes exactly as supplied.
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

const OFF = process.env.NEXT_PUBLIC_MONETAG === "off"; // production default: the build must contain no Monetag at all
test.beforeEach(({}, info) => test.skip(OFF && !info.title.startsWith("[off]"), "Monetag disabled in this build"));

const requests: string[] = [];
// No real ad traffic from tests: Monetag's scripts are stubbed (they load, draw nothing).
test.beforeEach(async ({ page }) => {
  requests.length = 0;
  for (const host of ["https://n6wxm.com/**", "https://nap5k.com/**", "https://bellnewyork.org/**"])
    await page.route(host, (r) => (requests.push(r.request().url()), r.fulfill({ contentType: "application/javascript", body: "" })));
});

const zoneScripts = (page: Page) =>
  page.evaluate(() => Array.from(document.querySelectorAll<HTMLScriptElement>("script[data-zone]")).map((s) => `${s.dataset.zone} ${s.src}`).sort());
const loaded = async (page: Page) => expect.poll(() => zoneScripts(page), { timeout: 10_000 }).toHaveLength(2);

test("the Monetag codes are stored byte for byte", () => {
  expect(zones.vignette.snippet).toBe(EXACT.vignette);
  expect(zones.inPagePush.snippet).toBe(EXACT.inPagePush);
});

test("allowed utility pages load each zone exactly once, after the page, with the supplied zone ids and URLs", async ({ page }) => {
  const allowed = ["/image-compressor/", "/pdf-merger/", "/json-formatter/", "/tools/", "/category/pdf-tools/"];
  for (const path of allowed) {
    await page.goto(path);
    await loaded(page);
    expect(await zoneScripts(page), path).toEqual(["12218944 https://nap5k.com/tag.min.js", "12218952 https://n6wxm.com/vignette.min.js"]);
    await page.waitForTimeout(1500);
    expect(await zoneScripts(page), path).toHaveLength(2); // no re-render duplicates
  }
  // One request per zone per page view.
  expect(requests.filter((u) => u.includes("vignette.min.js"))).toHaveLength(allowed.length);
  expect(requests.filter((u) => u.includes("tag.min.js"))).toHaveLength(allowed.length);
});

test("never on the homepage, any downloader page (with results) or the downloader category", async ({ page }) => {
  for (const path of ["/", "/social-media-downloader/", "/instagram-downloader/", "/tiktok-downloader/", "/facebook-downloader/", "/category/social-media-downloaders/"]) {
    const res = await page.goto(path);
    if (res?.status() === 404) continue; // category slug differs: covered by the build-wide test
    await page.waitForTimeout(1500);
    expect(await zoneScripts(page), path).toEqual([]);
    expect(await page.locator('script[id^="monetag-"]').count(), path).toBe(0);
  }
  expect(requests.filter((u) => /n6wxm|nap5k/.test(u))).toEqual([]);
});

test("runtime guard: the loader refuses a page that has the downloader, even if placed there by mistake", async ({ page }) => {
  await page.goto("/word-counter/");
  await loaded(page);
  const code = await page.evaluate(() => document.getElementById("monetag-12218952")?.textContent ?? "");
  expect(code).toContain("data-ytx-media-input");
  await page.goto("/instagram-downloader/"); // has the URL box and results area
  await page.evaluate((c) => { (window as unknown as { __ytxMonetag?: object }).__ytxMonetag = undefined; new Function(c)(); }, code);
  await page.waitForTimeout(500);
  expect(await zoneScripts(page)).toEqual([]);
});

test("the once-per-page guard: running a zone's loader again adds nothing", async ({ page }) => {
  await page.goto("/word-counter/");
  await loaded(page);
  await page.evaluate(() => {
    for (const id of ["monetag-12218952", "monetag-12218944"]) {
      const code = document.getElementById(id)?.textContent;
      if (code) new Function(code)(); // as if a re-render or second mount executed it
    }
  });
  expect(await zoneScripts(page)).toHaveLength(2);
});

test("no Monetag on policy, help, offline or unavailable-platform pages", async ({ page }) => {
  for (const path of ["/privacy/", "/about/", "/offline/", "/youtube-downloader/"]) {
    await page.goto(path);
    await page.waitForTimeout(1500);
    expect(await zoneScripts(page), path).toEqual([]);
  }
});

test("when Monetag is blocked, the page has no errors and the tool works", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("https://n6wxm.com/**", (r) => r.abort("blockedbyclient"));
  await page.route("https://nap5k.com/**", (r) => r.abort("blockedbyclient"));
  await page.goto("/word-counter/");
  await loaded(page);
  await page.locator("textarea").first().fill("one two three");
  await expect(page.getByText("3", { exact: true }).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("downloads can't be intercepted by page-level click listeners (as an overlay ad script might add)", async ({ page }) => {
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

test("/ads-check/ reports each Monetag zone's script state", async ({ page }) => {
  await page.goto("/ads-check/");
  const report = page.getByTestId("ads-report");
  await expect(report).toContainText("Monetag Vignette Banner (zone 12218952): script loaded", { timeout: 10_000 });
  await expect(report).toContainText("Monetag In-Page Push (zone 12218944): script loaded");
  await expect(report).toContainText("blocked by this site's security policy: nothing");
});

test("[off] a MONETAG=off build loads no Monetag zone anywhere", async ({ page }) => {
  test.skip(!OFF, "only for MONETAG=off builds");
  for (const path of ["/pdf-merger/", "/image-compressor/", "/tools/", "/category/pdf-tools/", "/ads-check/"]) {
    await page.goto(path);
    await page.waitForTimeout(1200);
    expect(await zoneScripts(page), path).toEqual([]);
  }
  expect(requests.filter((u) => /n6wxm|nap5k/.test(u))).toEqual([]);
});
