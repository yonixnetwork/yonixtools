import { expect, test, type Page } from "@playwright/test";

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

test("frames are isolated: opaque-origin sandbox, no top navigation, exact size reserved, lazy", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/image-compressor/");
  const ad = page.locator('aside[data-ad-unit="banner300x250"]');
  await ad.scrollIntoViewIfNeeded();
  const frame = ad.locator("iframe");
  await expect(frame).toHaveAttribute("sandbox", "allow-scripts allow-popups allow-popups-to-escape-sandbox");
  await expect(frame).toHaveAttribute("src", /^\/ad-frame\.html\?u=banner300x250&s=/);
  const box = await ad.locator(".ad-box").boundingBox();
  expect([Math.round(box!.width), Math.round(box!.height)]).toEqual([300, 250]);
  // The bottom leaderboard is far below the fold: not loaded yet.
  await expect(page.locator('aside[data-ad-unit="banner728x90"] iframe')).toHaveCount(0);
});

test("when the ad network is unreachable (or blocked), slots collapse and the page has no errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !m.location().url.includes("ad-frame") && !m.location().url.includes("bellnewyork") && errors.push(m.text()));
  await page.route("https://bellnewyork.org/**", (r) => r.abort("blockedbyclient"));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/word-counter/");
  await page.locator('aside[data-ad-unit="banner300x250"]').scrollIntoViewIfNeeded();
  await expect(page.locator('aside[data-ad-unit="banner300x250"]')).toHaveCount(0, { timeout: 15_000 });
  // The tool is unaffected.
  await page.locator("textarea").first().fill("one two three");
  await expect(page.getByText("3", { exact: true }).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("plumbing (simulated creative, not proof of Adsterra delivery): a rendered ad keeps its slot", async ({ page }) => {
  // Stand-in for the network's script: draws a 300×250 box where the real code would.
  await page.route("https://bellnewyork.org/22/620b3190e30ed523091b51770aea0b40", (r) =>
    r.fulfill({ contentType: "application/javascript", body: "document.write('<a href=\"https://example.com\" style=\"display:inline-block;width:300px;height:250px;background:#ddd\">ad</a>')" }));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/image-converter/");
  const ad = page.locator('aside[data-ad-unit="banner300x250"]');
  await ad.scrollIntoViewIfNeeded();
  await expect(ad).toHaveAttribute("data-ad-state", "filled", { timeout: 10_000 });
  await page.waitForTimeout(10_000);
  await expect(ad).toHaveCount(1); // filled slots never collapse
});
