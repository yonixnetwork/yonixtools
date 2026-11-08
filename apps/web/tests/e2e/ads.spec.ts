import { expect, test, type Page } from "@playwright/test";
import { isAdTraffic } from "./helpers";

// The four publisher codes exactly as supplied (whitespace included).
const EXACT = {
  native: `<script async="async" data-cfasync="false" src="https://bellnewyork.org/21/cdabddda1b7a8e769299c93b91d77822"></script>
<div id="container-cdabddda1b7a8e769299c93b91d77822"></div>`,
  banner300x250: `<script>
atOptions = {
'key' : '620b3190e30ed523091b51770aea0b40',
'format' : 'iframe',
'height' : 250,
'width' : 300,
'params' : {}
};
</script>
<script src="https://bellnewyork.org/22/620b3190e30ed523091b51770aea0b40"></script>`,
  banner728x90: `<script>
atOptions = {
'key' : '087c1ea1a028c67071c19090b33ca01b',
'format' : 'iframe',
'height' : 90,
'width' : 728,
'params' : {}
};
</script>
<script src="https://bellnewyork.org/22/087c1ea1a028c67071c19090b33ca01b"></script>`,
  banner320x50: `<script>
atOptions = {
'key' : '184daaa0dde35a067c7494257f37cd70',
'format' : 'iframe',
'height' : 50,
'width' : 320,
'params' : {}
};
</script>
<script src="https://bellnewyork.org/22/184daaa0dde35a067c7494257f37cd70"></script>`,
};

// No real ad traffic from tests: by default the network's scripts load and render nothing
// (a slot then stays "loading" for ~8 s before collapsing). Tests override this where needed.
test.beforeEach(async ({ page }) => {
  await page.route("https://bellnewyork.org/**", (r) => r.fulfill({ contentType: "application/javascript", body: "" }));
});

async function slots(page: Page) {
  await page.waitForTimeout(400);
  return page.locator("aside.ad-slot").evaluateAll((els) => els.map((e) => ({ unit: e.getAttribute("data-ad-unit"), label: e.querySelector(".ad-label")?.textContent, visible: (e as HTMLElement).offsetParent !== null })));
}

test("the ad frame serves the four publisher codes byte for byte", async ({ request }) => {
  const html = await (await request.get("/ad-frame.html")).text();
  const units = JSON.parse(html.match(/var UNITS = (\{.*\});\n\s*var q/s)![1]);
  expect(units).toEqual(EXACT);
  expect(html).toContain("document.write(UNITS[unit])");
  expect(html).not.toMatch(/popunder|smartlink|socialbar|social-bar/i); // disabled formats never loaded
});

test.describe("desktop placements", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("homepage: 728×90 leaderboard below the downloader and a native banner", async ({ page }) => {
    await page.goto("/");
    expect((await slots(page)).map((s) => s.unit)).toEqual(["banner728x90", "native"]);
  });

  test("tool page: 300×250 below the tool, native in the content, desktop leaderboard", async ({ page }) => {
    for (const path of ["/image-compressor/", "/pdf-merger/", "/qr-code-generator/", "/json-formatter/", "/loan-calculator/", "/color-converter/", "/video-info/", "/random-number-generator/", "/meta-tag-generator/", "/word-counter/"]) {
      await page.goto(path);
      const s = await slots(page);
      expect(s.map((x) => x.unit), path).toEqual(["banner300x250", "native", "banner728x90"]);
      expect(new Set(s.map((x) => x.unit)).size, path).toBe(s.length); // never the same unit twice
      expect(s.every((x) => x.label === "Advertisement"), path).toBe(true);
      // The first ad comes after the tool surface, never inside it.
      expect(await page.locator(".tool-surface aside.ad-slot").count(), path).toBe(0);
    }
  });

  test("downloader page: leaderboard below the downloader, native between sections, 300×250 after the FAQ", async ({ page }) => {
    await page.goto("/instagram-downloader/");
    expect((await slots(page)).map((s) => s.unit)).toEqual(["banner728x90", "native", "banner300x250"]);
    expect(await page.locator("#downloader aside.ad-slot").count()).toBe(0);
  });

  test("no ads on pages of unavailable platforms or on policy pages", async ({ page }) => {
    for (const path of ["/youtube-downloader/", "/reddit-downloader/", "/privacy/", "/about/", "/offline/"]) {
      await page.goto(path);
      expect(await page.locator("aside.ad-slot").count(), path).toBe(0);
    }
  });
});

test.describe("phone placements", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("phones get 320×50 (never a squeezed 728×90) and at most two ads on a tool page", async ({ page }) => {
    await page.goto("/");
    expect((await slots(page)).map((s) => s.unit)).toEqual(["banner320x50", "native"]);
    await page.goto("/image-compressor/");
    const s = (await slots(page)).filter((x) => x.visible);
    expect(s.map((x) => x.unit)).toEqual(["banner300x250", "native"]); // leaderboard is desktop-only on tool pages
    await page.goto("/tiktok-downloader/");
    expect((await slots(page)).map((s) => s.unit)).toEqual(["banner320x50", "native", "banner300x250"]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

const CREATIVE_300 = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="250"><rect width="300" height="250" fill="#ccc"/></svg>')}`;
const stub = (body: string) => ({ contentType: "application/javascript", body });

test("frames: same-origin sandbox without top navigation, banner size reserved, label hidden until an ad renders, lazy", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/image-compressor/");
  const ad = page.locator('aside[data-ad-unit="banner300x250"]');
  await ad.scrollIntoViewIfNeeded();
  const frame = ad.locator("iframe");
  // Adsterra's code throws in an opaque-origin sandbox (measured on the live site), so frames keep the site's origin, still without allow-top-navigation.
  await expect(frame).toHaveAttribute("sandbox", "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox");
  await expect(frame).toHaveAttribute("src", /^(https?:\/\/[^/]+)?\/ad-frame\.html\?u=banner300x250&s=/);
  const box = await ad.locator(".ad-box").boundingBox();
  expect([Math.round(box!.width), Math.round(box!.height)]).toEqual([300, 250]);
  await expect(ad).toHaveAttribute("data-ad-state", "loading");
  await expect(ad.locator(".ad-label")).toBeHidden(); // no "Advertisement" over empty space
  // Native reserves a small strip only, not a tall empty box.
  const native = page.locator('aside[data-ad-unit="native"] .ad-box');
  expect(Math.round((await native.boundingBox())!.height)).toBeLessThanOrEqual(100);
  // The bottom leaderboard is far below the fold: not loaded yet.
  await expect(page.locator('aside[data-ad-unit="banner728x90"] iframe')).toHaveCount(0);
});

test("when the ad network is unreachable (or blocked), slots collapse within seconds and the page has no errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !isAdTraffic(m.location().url) && errors.push(m.text()));
  // Every ad network blocked, as an ad blocker would (the browser's own "failed to load" notices for them are not app errors).
  for (const host of ["https://bellnewyork.org/**", "https://n6wxm.com/**", "https://nap5k.com/**"]) await page.route(host, (r) => r.abort("blockedbyclient"));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/word-counter/");
  // It may already be gone by the time we scroll (scripts fail at once), so scroll without waiting on it.
  await page.evaluate(() => document.querySelector('aside[data-ad-unit="banner300x250"]')?.scrollIntoView());
  const ad = page.locator('aside[data-ad-unit="banner300x250"]');
  // On screen: it turns blank and unlabeled within seconds, and collapses on the next interaction (no layout shift while being looked at).
  await expect(ad).toHaveAttribute("data-ad-state", "empty", { timeout: 4_000 });
  await expect(ad.locator(".ad-label")).toBeHidden();
  await page.keyboard.press("Shift");
  await expect(ad).toHaveCount(0);
  // Off screen: slots collapse by themselves.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.locator('aside[data-ad-unit="native"]')).toHaveCount(0, { timeout: 4_000 });
  // The tool is unaffected.
  await page.locator("textarea").first().fill("one two three");
  await expect(page.getByText("3", { exact: true }).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("a script that runs but returns nothing, or a blank iframe, is never treated as an ad: the slot collapses", async ({ page }) => {
  await page.route("https://bellnewyork.org/22/620b3190e30ed523091b51770aea0b40", (r) =>
    r.fulfill(stub("var f=document.createElement('iframe');f.width=300;f.height=250;f.style.border=0;document.body.appendChild(f);")));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/image-converter/");
  const ad = page.locator('aside[data-ad-unit="banner300x250"]');
  await ad.scrollIntoViewIfNeeded();
  await page.waitForTimeout(3_000);
  await expect(ad).toHaveAttribute("data-ad-state", "loading");
  await expect(ad).toHaveAttribute("data-ad-state", "empty", { timeout: 10_000 });
  await page.mouse.click(5, 5); // next interaction: collapses
  await expect(ad).toHaveCount(0);
});

test("plumbing (simulated creative, not proof of Adsterra delivery): a rendered banner keeps its slot and shows the label", async ({ page }) => {
  // Stand-in for the network's script: draws a 300×250 image where the real code would.
  await page.route("https://bellnewyork.org/22/620b3190e30ed523091b51770aea0b40", (r) =>
    r.fulfill(stub(`document.write('<a href="https://example.com"><img width="300" height="250" src="${CREATIVE_300}"></a>')`)));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/image-converter/");
  const ad = page.locator('aside[data-ad-unit="banner300x250"]');
  await ad.scrollIntoViewIfNeeded();
  await expect(ad).toHaveAttribute("data-ad-state", "filled", { timeout: 10_000 });
  await expect(ad.locator(".ad-label")).toBeVisible();
  await page.waitForTimeout(10_000);
  await expect(ad).toHaveCount(1); // filled slots never collapse
});

test("plumbing (simulated): a native creative grows its slot to the creative's height", async ({ page }) => {
  await page.route("https://bellnewyork.org/21/cdabddda1b7a8e769299c93b91d77822", (r) =>
    r.fulfill(stub("var c=document.getElementById('container-cdabddda1b7a8e769299c93b91d77822');c.innerHTML='<div style=\"height:240px;background:#ddd\">Sponsored story headline text</div>';")));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/image-converter/");
  const ad = page.locator('aside[data-ad-unit="native"]');
  await ad.scrollIntoViewIfNeeded();
  await expect(ad).toHaveAttribute("data-ad-state", "filled", { timeout: 10_000 });
  await expect.poll(async () => Math.round((await ad.locator(".ad-box").boundingBox())!.height)).toBe(240);
});

test("/ads-check/ produces a copyable report that tells blocked scripts apart from no fill", async ({ page }) => {
  await page.route("https://bellnewyork.org/22/**", (r) => r.abort("blockedbyclient"));
  await page.route("https://bellnewyork.org/21/**", (r) => r.fulfill(stub("")));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/ads-check/");
  for (const a of await page.locator("aside.ad-slot").all()) await a.scrollIntoViewIfNeeded();
  const report = page.getByTestId("ads-report");
  await expect(report).toContainText("Site mode: same-origin");
  await expect(report).toContainText("banner300x250: EMPTY: ad script blocked or unreachable", { timeout: 15_000 });
  await expect(report).toContainText("native: EMPTY: script loaded and ran without errors, no creative returned", { timeout: 15_000 });
  await expect(report).toContainText("cookies=ok storage=ok");
});
