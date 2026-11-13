import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
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
  for (const h of ["https://bellnewyork.org/**", "https://nap5k.com/**", "https://n6wxm.com/**"]) await page.route(h, (r) => r.fulfill({ contentType: "application/javascript", body: "" }));
});

async function slots(page: Page) {
  await page.waitForTimeout(400);
  return page.locator("aside.ad-slot").evaluateAll((els) => els.map((e) => ({ unit: e.getAttribute("data-ad-unit"), label: e.querySelector(".ad-label")?.textContent, visible: (e as HTMLElement).offsetParent !== null })));
}

test("the public ad frame serves the four Adsterra codes byte for byte (Monetag only when the administrator enables it)", async ({ request }) => {
  const res = await request.get("http://localhost:4175/ad-frame.html");
  const html = await res.text();
  const units = JSON.parse(html.match(/var UNITS = (\{.*\});\n\s*var q/s)![1]);
  const { monetagPush, monetagVignette, ...adsterra } = units;
  expect(adsterra).toEqual(EXACT);
  const monetag = JSON.parse(readFileSync(new URL("../../src/lib/ads/monetag.json", import.meta.url), "utf8"));
  if (process.env.NEXT_PUBLIC_MONETAG === "on") {
    expect(monetagPush).toBe(monetag.inPagePush.snippet);
    expect(monetagVignette).toBe(monetag.vignette.snippet);
  } else {
    expect([monetagPush, monetagVignette]).toEqual([undefined, undefined]);
    expect(html).not.toMatch(/nap5k\.com|n6wxm\.com|12218944|12218952/); // no Monetag code at all in the public frame
  }
  expect(html).toContain("document.write(UNITS[unit])");
  expect(html).not.toMatch(/popunder|smartlink|socialbar|social-bar|multitag/i); // disabled formats never loaded
});

test.describe("desktop placements", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("homepage: leaderboard below the downloader, 300×250 between sections (two ads)", async ({ page }) => {
    await page.goto("/");
    expect((await slots(page)).map((s) => s.unit)).toEqual(["banner728x90", "banner300x250"]);
    expect(await page.locator(".hero aside.ad-slot, #downloader aside.ad-slot").count()).toBe(0);
  });

  test("tool page: leaderboard below the introduction, 300×250 below the tool (two ads)", async ({ page }) => {
    for (const path of ["/image-compressor/", "/pdf-merger/", "/qr-code-generator/", "/json-formatter/", "/loan-calculator/", "/color-converter/", "/video-info/", "/random-number-generator/", "/meta-tag-generator/", "/word-counter/"]) {
      await page.goto(path);
      const s = await slots(page);
      expect(s.map((x) => x.unit), path).toEqual(["banner728x90", "banner300x250"]);
      expect(new Set(s.map((x) => x.unit)).size, path).toBe(s.length); // never the same unit twice
      expect(s.every((x) => x.label === "Advertisement"), path).toBe(true);
      // Ads sit before and after the tool surface, never inside it.
      expect(await page.locator(".tool-surface aside.ad-slot").count(), path).toBe(0);
    }
  });

  test("downloader page: leaderboard below the downloader and results, 300×250 between content sections (two ads)", async ({ page }) => {
    await page.goto("/instagram-downloader/");
    expect((await slots(page)).map((s) => s.unit)).toEqual(["banner728x90", "banner300x250"]);
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

  test("phones get 320×50 (never a squeezed 728×90), no native (its 4 tiles stack), at most two ads on a tool page", async ({ page }) => {
    const visible = async () => (await slots(page)).filter((x) => x.visible).map((x) => x.unit);
    await page.goto("/");
    expect(await visible()).toEqual(["banner320x50", "banner300x250"]);
    await page.goto("/image-compressor/");
    expect(await visible()).toEqual(["banner320x50", "banner300x250"]);
    await page.goto("/tiktok-downloader/");
    expect(await visible()).toEqual(["banner320x50", "banner300x250"]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

const CREATIVE_300 = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="250"><rect width="300" height="250" fill="#ccc"/></svg>')}`;
const stub = (body: string) => ({ contentType: "application/javascript", body });

test("frames: loaded from the separate ad origin, no top navigation, banner size reserved, label hidden until an ad renders, lazy", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/image-compressor/");
  const ad = page.locator('aside[data-ad-unit="banner300x250"]');
  await ad.scrollIntoViewIfNeeded();
  const frame = ad.locator("iframe");
  // The frame keeps ITS OWN (ad) origin, which Adsterra's code needs; never allow-top-navigation.
  await expect(frame).toHaveAttribute("sandbox", "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox");
  await expect(frame).toHaveAttribute("src", /^http:\/\/localhost:4175\/ad-frame\.html\?u=banner300x250&s=/);
  const box = await ad.locator(".ad-box").boundingBox();
  expect([Math.round(box!.width), Math.round(box!.height)]).toEqual([300, 250]);
  await expect(ad).toHaveAttribute("data-ad-state", "loading");
  await expect(ad.locator(".ad-label")).toBeHidden(); // no "Advertisement" over empty space
  // Native (All tools, after the list) reserves a small strip only, not a tall empty box; and it's lazy:
  // far below the viewport, its frame hasn't loaded yet.
  await page.goto("/tools/");
  const native = page.locator('aside.ad-native');
  expect(Math.round((await native.locator(".ad-box").boundingBox())!.height)).toBeLessThanOrEqual(100);
  expect(await native.evaluate((e) => e.getBoundingClientRect().top - innerHeight)).toBeGreaterThan(400);
  await page.waitForTimeout(800);
  await expect(native.locator("iframe")).toHaveCount(0);
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
  await page.locator('aside.ad-banner300x250').first().waitFor({ state: "attached" });
  await page.evaluate(() => document.querySelector("aside.ad-banner300x250")?.scrollIntoView());
  const ad = page.locator('aside[data-ad-unit="banner300x250"]');
  // On screen: it turns blank and unlabeled within seconds, and collapses on the next interaction (no layout shift while being looked at).
  await expect(ad).toHaveAttribute("data-ad-state", "empty", { timeout: 4_000 });
  await expect(ad.locator(".ad-label")).toBeHidden();
  await page.keyboard.press("Shift");
  await expect(ad).toHaveCount(0);
  // Off screen: slots collapse by themselves (the leaderboard above the tool, once scrolled away).
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.locator('aside[data-ad-unit="banner728x90"]')).toHaveCount(0, { timeout: 4_000 });
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
  await page.goto("/tools/");
  const ad = page.locator('aside[data-ad-unit="native"]');
  await ad.scrollIntoViewIfNeeded();
  await expect(ad).toHaveAttribute("data-ad-state", "filled", { timeout: 10_000 });
  await expect.poll(async () => Math.round((await ad.locator(".ad-box").boundingBox())!.height)).toBe(240);
});

// Isolation of the separate ad origin, with a hostile stand-in for an ad script
// (nothing contacts an ad network). The page is on :4173, the ad origin on :4175.
test("a hostile creative can't read the pasted URL or the page, run code in it, or redirect it", async ({ page }) => {
  const hostile = `var r = {}, P = parent;
    function t(k, f) { try { r[k] = String(f()); } catch (e) { r[k] = "BLOCKED"; } }
    setTimeout(function () {
      t("url", function () { return P.document.getElementById("dl-url").value; });
      t("dom", function () { return P.document.title; });
      t("top", function () { return top.location.href; });
      t("inject", function () { var s = P.document.createElement("script"); s.textContent = "location.href='https://example.org/hijack'"; P.document.body.appendChild(s); return "ran"; });
      t("nav", function () { top.location.href = "https://example.org/topnav"; return "attempted"; });
      t("pageStorage", function () { return localStorage.getItem("site_secret"); });
      P.postMessage({ ytxAd: "x", state: "filled", height: 900 }, "*");
      window.__r = r;
    }, 1500);`;
  await page.route("https://example.org/**", (r) => r.fulfill({ contentType: "text/html", body: "other site" }));
  await page.route("https://bellnewyork.org/22/087c1ea1a028c67071c19090b33ca01b", (r) => r.fulfill(stub(hostile)));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/instagram-downloader/");
  await page.evaluate(() => { localStorage.setItem("site_secret", "s"); document.cookie = "site_cookie=c; path=/"; });
  await page.locator("#dl-url").fill("https://www.instagram.com/p/PRIVATE-TEST/");
  const slot = page.locator('aside[data-ad-unit="banner728x90"]');
  await slot.scrollIntoViewIfNeeded();
  await page.waitForTimeout(3000);
  const frame = page.frames().find((f) => f.url().includes("u=banner728x90"))!;
  expect(new URL(frame.url()).origin).toBe("http://localhost:4175");
  const r = await frame.evaluate(() => (window as unknown as { __r: Record<string, string> }).__r);
  expect(r).toEqual({ url: "BLOCKED", dom: "BLOCKED", top: "BLOCKED", inject: "BLOCKED", nav: "BLOCKED", pageStorage: "null" });
  expect(page.url()).toBe("http://localhost:4173/instagram-downloader/");
  await expect(page.locator("#dl-url")).toHaveValue("https://www.instagram.com/p/PRIVATE-TEST/");
});

// Parent-domain cookies: ad code on the ad origin tries to set cookies for the whole domain (as
// code on ads.yonixtools.com could for yonixtools.com). The frame's guard strips the Domain attribute,
// so they stay host-only on the ad host. Modelled with fulfilled https hosts under one test domain
// (nothing leaves the machine). Best effort: see RELEASE_ADS_ADMIN_PWA.md section 11.
test("ad code can't set cookies for the parent domain through document.cookie, child frames or the Cookie Store API", async ({ page, context, request }) => {
  const frameHtml = await (await request.get("http://localhost:4175/ad-frame.html")).text();
  const TOSS = `
    document.cookie = "tossA=1; Domain=ytx-test.example; Path=/";
    var f = document.createElement("iframe"); document.body.appendChild(f); f.contentDocument.cookie = "tossB=1; domain=.ytx-test.example; path=/";
    if (window.cookieStore) cookieStore.set({ name: "tossC", value: "1", domain: "ytx-test.example", path: "/" }).catch(function () {});
    document.cookie = "plain=1; Path=/";`;
  await page.route("https://bellnewyork.org/**", (r) => r.fulfill({ contentType: "application/javascript", body: TOSS }));
  await page.route("https://ads.ytx-test.example/**", (r) => r.fulfill({ contentType: "text/html", body: frameHtml }));
  await page.route("https://unguarded.ytx-test.example/**", (r) => r.fulfill({ contentType: "text/html", body: "<!doctype html><body><script>" + TOSS.replace(/toss/g, "ctl").replace("plain", "ctlplain") + "</script>" }));
  // Control: an unguarded document on a sibling host CAN set cookies for the whole domain.
  await page.goto("https://unguarded.ytx-test.example/");
  await expect.poll(async () => (await context.cookies()).find((c) => c.name === "ctlA")?.domain).toBe(".ytx-test.example");
  // The ad frame document: the same attempts stay host-only.
  await page.goto("https://ads.ytx-test.example/ad-frame.html?u=banner300x250&s=x");
  await expect.poll(async () => (await context.cookies()).some((c) => c.name === "plain")).toBe(true);
  await page.waitForTimeout(500);
  const jar = await context.cookies();
  const toss = jar.filter((c) => c.name.startsWith("toss"));
  expect(toss.length).toBeGreaterThanOrEqual(2);
  for (const c of toss) expect(c.domain, c.name).toBe("ads.ytx-test.example"); // never ".ytx-test.example"
});

// Downloads in browser tools: ads on the page, a creative that tries to open windows, and still no
// popup, new tab or navigation when the visitor clicks a download button.
test("download buttons never open a popup or new tab, even with an ad on the page trying to", async ({ page, context }) => {
  const opened: string[] = [];
  context.on("page", (p) => opened.push(p.url()));
  await page.route("https://bellnewyork.org/**", (r) => r.fulfill({ contentType: "application/javascript", body: "document.addEventListener('click',function(){window.open('https://example.com/ad','_blank')},true);try{top.addEventListener('click',function(){window.open('https://example.com/top')},true)}catch(e){}" }));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/qr-code-generator/");
  for (const a of await page.locator("aside.ad-slot").all()) await a.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(800);
  await page.evaluate(() => scrollTo(0, 0));
  await page.locator("#qr-text").fill("https://example.com");
  for (const name of ["PNG", "SVG"]) {
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name, exact: true }).click()]);
    expect(dl.suggestedFilename()).toMatch(new RegExp(`\\.${name.toLowerCase()}$`));
  }
  await page.waitForTimeout(800);
  expect(opened).toEqual([]);
  expect(new URL(page.url()).pathname).toBe("/qr-code-generator/");
});

// Download pop-up on the browser tools (owner request): the same panel as on the downloaders.
test("tool download pop-up: appears after a download with one labelled ad, never delays it, closes, and the ad loads once", async ({ page, context }) => {
  const opened: string[] = [];
  context.on("page", (p) => opened.push(p.url()));
  const frames: string[] = [];
  page.on("request", (r) => /ad-frame\.html\?u=banner300x250/.test(r.url()) && frames.push(r.url()));
  await page.route("https://bellnewyork.org/22/620b3190e30ed523091b51770aea0b40", (r) => r.fulfill(stub(`document.write('<a href="https://example.com"><img width="300" height="250" src="${CREATIVE_300}"></a>')`)));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/qr-code-generator/");
  const panel = page.getByTestId("tool-download-panel");
  await expect(panel).toHaveCount(0); // nothing, and no ad, before a download
  await page.locator("#qr-text").fill("https://example.com");
  const t0 = Date.now();
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "PNG", exact: true }).click()]);
  expect(Date.now() - t0).toBeLessThan(5_000); // no countdown, no waiting for the ad
  expect(dl.suggestedFilename()).toMatch(/\.png$/);
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("Download started");
  const ad = panel.locator('aside[data-ad-unit="banner300x250"]');
  await expect(ad).toHaveAttribute("data-ad-state", "filled", { timeout: 10_000 });
  await expect(ad.locator(".ad-label")).toHaveText("Advertisement");
  const inPanel = () => frames.filter((u) => !/s=$/.test(u)).length;
  const before = inPanel();
  await panel.getByRole("button", { name: "Close", exact: true }).click();
  await expect(panel).toBeHidden();
  // A second download shows the panel again without reloading (refreshing) its ad.
  await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "SVG", exact: true }).click()]);
  await expect(panel).toBeVisible();
  await page.waitForTimeout(800);
  expect(inPanel()).toBe(before);
  expect(opened).toEqual([]);
  expect(new URL(page.url()).pathname).toBe("/qr-code-generator/");
});

test("tool download pop-up: with ads blocked it still confirms the download, with no empty box", async ({ page }) => {
  await page.route("https://bellnewyork.org/**", (r) => r.abort("blockedbyclient"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/qr-code-generator/");
  await page.locator("#qr-text").fill("https://example.com");
  await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "PNG", exact: true }).click()]);
  const panel = page.getByTestId("tool-download-panel");
  await expect(panel).toContainText("Download started");
  await expect(panel.locator(".ad-label")).toBeHidden();
  await panel.getByRole("button", { name: "Close", exact: true }).click();
  await expect(panel).toBeHidden();
});
