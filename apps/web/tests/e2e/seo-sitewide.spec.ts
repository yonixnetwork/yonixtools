import { expect, test } from "@playwright/test";

// Crawls the built site through its own sitemap, the way a search engine would. Production URLs
// (https://yonixtools.com/...) are mapped to the local test server.
const SITE = "https://yonixtools.com";
const local = (u: string) => u.replace(SITE, "");

test("every sitemap page: 200, one H1, self canonical, indexable, unique title and description, full social cards, valid structured data", async ({ page, request }) => {
  test.setTimeout(240_000);
  const xml = await (await request.get("/sitemap.xml")).text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  expect(locs.length).toBeGreaterThan(50);
  expect(xml).not.toMatch(/<changefreq>|<priority>/); // only real signals: loc + lastmod
  const titles = new Map<string, string>(), descs = new Map<string, string>();
  const links = new Set<string>();
  for (const loc of locs) {
    const res = await page.goto(local(loc));
    expect(res?.status(), loc).toBe(200);
    const meta = await page.evaluate(() => {
      const m = (sel: string) => document.querySelector(sel)?.getAttribute("content") ?? null;
      return {
        h1: document.querySelectorAll("h1").length,
        canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? null,
        robots: m('meta[name="robots"]'),
        title: document.title,
        desc: m('meta[name="description"]'),
        ogUrl: m('meta[property="og:url"]'),
        ogImage: m('meta[property="og:image"]'),
        ogTitle: m('meta[property="og:title"]'),
        card: m('meta[name="twitter:card"]'),
        twImage: m('meta[name="twitter:image"]'),
        ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent || ""),
        links: [...document.querySelectorAll("a[href^='/']")].map((a) => a.getAttribute("href")!),
        imgsNoAlt: [...document.querySelectorAll("img:not([alt])")].length,
      };
    });
    expect(meta.h1, `${loc}: H1 count`).toBe(1);
    expect(meta.canonical, loc).toBe(loc);
    expect(meta.robots ?? "index", loc).not.toMatch(/noindex/);
    expect(meta.title.length, `${loc}: title "${meta.title}"`).toBeGreaterThan(10);
    expect(meta.title.length, `${loc}: title "${meta.title}"`).toBeLessThanOrEqual(65);
    expect(titles.has(meta.title), `${loc}: same title as ${titles.get(meta.title)}`).toBe(false);
    titles.set(meta.title, loc);
    expect(meta.desc, loc).toBeTruthy();
    expect(meta.desc!.length, `${loc}: description length`).toBeGreaterThanOrEqual(70);
    expect(meta.desc!.length, `${loc}: description length`).toBeLessThanOrEqual(160);
    expect(descs.has(meta.desc!), `${loc}: same description as ${descs.get(meta.desc!)}`).toBe(false);
    descs.set(meta.desc!, loc);
    expect(meta.ogUrl, loc).toBe(loc);
    expect(meta.ogTitle, loc).toBeTruthy();
    expect(meta.ogImage, loc).toBe(`${SITE}/og-image.png`);
    expect(meta.card, loc).toBe("summary_large_image");
    expect(meta.twImage, loc).toBe(`${SITE}/og-image.png`);
    expect(meta.imgsNoAlt, `${loc}: images without alt`).toBe(0);
    const types = meta.ld.map((s) => {
      const d = JSON.parse(s); // throws on invalid JSON-LD
      expect(d["@context"], loc).toBe("https://schema.org");
      return d["@type"];
    });
    if (loc === `${SITE}/`) expect(types).toEqual(expect.arrayContaining(["Organization", "WebSite"]));
    if (/\/guides\/[a-z0-9-]+\/$/.test(loc)) expect(types, loc).toEqual(expect.arrayContaining(["Article", "BreadcrumbList"]));
    expect(JSON.stringify(meta.ld), loc).not.toMatch(/aggregateRating|"review"|ratingValue|ratingCount|"interactionCount"/); // no invented ratings or stats
    for (const l of meta.links) links.add(l.split("#")[0]);
  }
  // Every internal link on those pages resolves directly (200), without a redirect hop.
  const broken: string[] = [];
  for (const l of links) {
    if (!l || l.startsWith("/api/")) continue;
    const r = await request.get(l, { maxRedirects: 0 });
    if (r.status() !== 200) broken.push(`${l} -> ${r.status()}`);
  }
  expect(broken).toEqual([]);
});

test("robots.txt allows crawling, keeps admin and API out, names the sitemap; the share image exists", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toMatch(/User-Agent: \*\nAllow: \/\nDisallow: \/admin\/\nDisallow: \/api\//);
  expect(robots).not.toMatch(/Disallow: \/(_next|icons|og-image|\s*$)/m); // never block assets or the whole site
  expect(robots).toContain(`Sitemap: ${SITE}/sitemap.xml`);
  const og = await request.get("/og-image.png");
  expect(og.status()).toBe(200);
  expect(og.headers()["content-type"]).toContain("image/png");
});

test("guides are reachable through ordinary links from the home page, header and the tools they cover", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('header a[href="/guides/"]').first()).toBeAttached();
  await expect(page.locator('main a[href="/guides/how-to-merge-pdf-files/"], a[href="/guides/how-to-merge-pdf-files/"]').first()).toBeAttached();
  await page.goto("/pdf-merger/");
  await expect(page.locator('aside a[href="/guides/how-to-merge-pdf-files/"]')).toBeAttached();
  await page.goto("/category/pdf-tools/");
  await expect(page.locator('a[href="/guides/how-to-merge-pdf-files/"]')).toBeAttached();
  await page.goto("/guides/how-to-merge-pdf-files/");
  await expect(page.locator("h1")).toHaveText("How to merge PDF files online, free and without uploading");
  await expect(page.locator('article a[href="/pdf-merger/"]').first()).toBeVisible();
});

test("pages that must stay out of search are noindex and not in the sitemap", async ({ page, request }) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  for (const p of ["/youtube-downloader/", "/reddit-downloader/", "/offline/"]) {
    await page.goto(p);
    expect(await page.locator('meta[name="robots"]').getAttribute("content"), p).toMatch(/noindex/);
    expect(xml, p).not.toContain(`${SITE}${p}`);
  }
  await page.goto("/tools/?q=pdf");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${SITE}/tools/`); // search results canonicalise to /tools/
});
