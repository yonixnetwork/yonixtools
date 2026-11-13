import { describe, expect, it, vi } from "vitest";

// Production configuration: the downloader backend is wired up (NEXT_PUBLIC_DOWNLOADER_API_URL=/api),
// so downloader pages are live and indexable, exactly as on yonixtools.com.
async function prod() {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_DOWNLOADER_API_URL", "/api");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://yonixtools.com");
  const sitemap = (await import("@/app/sitemap")).default();
  const robots = (await import("@/app/robots")).default();
  const reg = await import("@/lib/registry");
  const g = await import("@/lib/guides");
  const seo = await import("@/lib/seo");
  return { sitemap, robots, reg, g, seo };
}

describe("sitemap (production configuration)", () => {
  it("lists every indexable page once, as an absolute https canonical URL, and nothing private", async () => {
    const { sitemap, reg, g } = await prod();
    const urls = sitemap.map((e) => e.url);
    expect(new Set(urls).size).toBe(urls.length);
    for (const u of urls) {
      expect(u, u).toMatch(/^https:\/\/yonixtools\.com\/([a-z0-9-]+\/)*$/); // canonical form: https, apex domain, trailing slash, no query
      expect(u).not.toMatch(/\/(admin|api|offline|ads-check)\b|ad-frame|ad-test|staging|trycloudflare|\?/);
    }
    for (const t of reg.allTools) {
      const listed = urls.includes(`https://yonixtools.com/${t.slug}/`);
      expect(listed, t.slug).toBe(reg.isIndexable(t)); // hidden (YouTube, Reddit, ...) never listed
    }
    for (const x of g.guides) expect(urls).toContain(`https://yonixtools.com/guides/${x.slug}/`);
    expect(urls).toContain("https://yonixtools.com/twitch-clip-downloader/");
    expect(urls).not.toContain("https://yonixtools.com/youtube-downloader/");
  });

  it("lastmod dates are real dates: not in the future, not before the site existed", async () => {
    const { sitemap } = await prod();
    for (const e of sitemap) {
      const d = new Date(e.lastModified as Date);
      expect(Number.isNaN(d.getTime()), e.url).toBe(false);
      expect(d.getTime(), e.url).toBeLessThanOrEqual(Date.now());
      expect(d.getTime(), e.url).toBeGreaterThanOrEqual(Date.parse("2026-11-01"));
    }
  });
});

describe("robots.txt", () => {
  it("allows public pages and assets, keeps admin and API out, and names the sitemap", async () => {
    const { robots } = await prod();
    const rule = Array.isArray(robots.rules) ? robots.rules[0] : robots.rules;
    expect(rule.userAgent).toBe("*");
    expect(rule.allow).toBe("/");
    expect(rule.disallow).toEqual(["/admin/", "/api/"]); // never /_next/, CSS, JS or images
    expect(robots.sitemap).toBe("https://yonixtools.com/sitemap.xml");
  });
});

describe("titles and descriptions", () => {
  it("every indexable tool: title ≤ 60 characters, description 70–160, all unique", async () => {
    const { reg } = await prod();
    const live = reg.allTools.filter(reg.isIndexable);
    for (const t of live) {
      expect(t.seo.title.length, t.slug).toBeLessThanOrEqual(60);
      expect(t.seo.description.length, t.slug).toBeGreaterThanOrEqual(70);
      expect(t.seo.description.length, t.slug).toBeLessThanOrEqual(160);
    }
    expect(new Set(live.map((t) => t.seo.title)).size).toBe(live.length);
    expect(new Set(live.map((t) => t.seo.description)).size).toBe(live.length);
  });

  it("category descriptions fit 160 characters without cutting a word", async () => {
    const { reg, seo } = await prod();
    for (const c of reg.categories) {
      const d = seo.categoryDescription(c.description, reg.toolsInCategory(c.id).map((t) => t.name));
      expect(d.length, c.slug).toBeLessThanOrEqual(160);
      expect(d, c.slug).toMatch(/\.$/);
      expect(d, c.slug).not.toMatch(/\b[A-Z][a-z]?\.$/); // not "…Facebook V." style truncation
    }
  });
});

describe("guides", () => {
  it("are complete, accurate in their links, and year-specific ones are still within their review date", async () => {
    const { reg, g } = await prod();
    const routes = new Set([
      "/", "/tools/", "/guides/", "/about/", "/privacy/",
      ...reg.allTools.filter(reg.isIndexable).map((t) => `/${t.slug}/`),
      ...reg.categories.map((c) => `/category/${c.slug}/`),
      ...g.guides.map((x) => `/guides/${x.slug}/`),
    ]);
    const titles = new Set<string>();
    for (const x of g.guides) {
      expect(x.title.length, x.slug).toBeLessThanOrEqual(60);
      expect(x.description.length, x.slug).toBeGreaterThanOrEqual(70);
      expect(x.description.length, x.slug).toBeLessThanOrEqual(160);
      expect(titles.has(x.title), x.slug).toBe(false);
      titles.add(x.title);
      expect(Date.parse(x.updated)).toBeGreaterThanOrEqual(Date.parse(x.published));
      for (const s of x.tools) expect(reg.getTool(s) && reg.isIndexable(reg.getTool(s)!), `${x.slug}: tool ${s}`).toBe(true);
      const text = JSON.stringify(x);
      for (const m of text.matchAll(/\]\((\/[^)]*)\)/g)) expect(routes.has(m[1]), `${x.slug}: link ${m[1]}`).toBe(true);
      expect(text, x.slug).not.toMatch(/youtube-downloader|vimeo|reddit-downloader/); // no links to unsupported platforms
      if (x.reviewBy) expect(Date.now(), `${x.slug} must be reviewed and updated by ${x.reviewBy}`).toBeLessThanOrEqual(Date.parse(x.reviewBy));
    }
  });
});
