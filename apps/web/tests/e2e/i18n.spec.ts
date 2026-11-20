/**
 * Localization, end to end, against the real static export (npm run build:test):
 *  - every built locale: <html lang/dir>, no missing-key markers, translated text (no English
 *    catalogue sentences left on the page), self-referencing canonical, noindex while unreviewed;
 *  - hreflang reciprocity and sitemap consistency over EVERY page of the export (static crawl);
 *  - language selector (search, keyboard, persistence, equivalent page), browser-language
 *    suggestion (never a redirect), RTL rendering, localized tools still work.
 */
import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const ROOT = path.join(process.cwd(), "out");
const MSG = path.join(process.cwd(), "src", "i18n", "messages");
const PUBLISHED = ["en", "es", "pt-BR", "fr", "de", "hi", "id", "ar", "zh-CN", "ja", "ru", "bn", "ur", "tr", "vi", "ko", "it", "nl", "th", "sw"];
const RTL = new Set(["ar", "ur"]);
const locales = PUBLISHED.filter((l) => fs.existsSync(path.join(ROOT, l.toLowerCase(), "index.html")));
const others = locales.filter((l) => l !== "en");

type Msgs = Record<string, string | Record<string, string>>;
const load = (l: string, ns: string): Msgs => {
  const f = path.join(MSG, l, `${ns}.json`);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : {};
};
const str = (m: Msgs, k: string) => (typeof m[k] === "string" ? (m[k] as string) : "");
const toolPath = (l: string, slug: string) => (l === "en" ? `/${slug}/` : `/${l.toLowerCase()}/${str(load(l, "registry"), `tool.${slug}.slug`) || slug}/`);
const route = (l: string, k: string) => (l === "en" ? k : str(load(l, "common"), `route.${k}`) || k);

/** English catalogue sentences (≥ 5 words) that the locale translated differently. */
function englishSentences(l: string, namespaces: string[]): string[] {
  const out: string[] = [];
  for (const ns of namespaces) {
    const en = load("en", ns), tr = load(l, ns);
    for (const [k, v] of Object.entries(en)) {
      if (typeof v !== "string" || /\{|</.test(v)) continue;
      const clean = v.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
      if (clean.split(/\s+/).length < 5) continue;
      if (JSON.stringify(tr[k]) === JSON.stringify(v)) continue;
      out.push(clean);
    }
  }
  return out;
}

async function visibleText(page: Page) {
  return page.evaluate(() => document.body.innerText);
}

test.describe("localized pages", () => {
  test.skip(others.length === 0, "no translated locale is built");

  for (const l of locales) {
    test(`${l}: home and a tool page are fully in the language`, async ({ page }) => {
      for (const p of [l === "en" ? "/" : `/${l.toLowerCase()}/`, toolPath(l, "pdf-merger"), toolPath(l, "word-counter")]) {
        await page.goto(p);
        const html = page.locator("html");
        await expect(html).toHaveAttribute("lang", l);
        await expect(html).toHaveAttribute("dir", RTL.has(l) ? "rtl" : "ltr");
        const text = await visibleText(page);
        expect(text, `${p}: missing-key marker`).not.toContain("⟦");
        if (l !== "en") {
          const leftovers = englishSentences(l, ["common", "pages", "registry", "tools-pdf", "tools-text", "tools-ui"]).filter((s) => text.includes(s));
          expect(leftovers, `${p}: English text left on a ${l} page`).toEqual([]);
          await expect(page.getByTestId("machine-notice")).toBeVisible();
          await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
        }
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
      }
    });
  }

  test("a localized tool still works (word counter, German)", async ({ page }) => {
    test.skip(!locales.includes("de"));
    await page.goto(toolPath("de", "word-counter"));
    await page.waitForFunction(() => document.documentElement.dataset.toolReady === "1");
    await page.locator("textarea").first().fill("eins zwei drei vier");
    await expect(page.getByTestId("stat-words")).toHaveText("4");
  });

  test("Arabic renders right-to-left without horizontal overflow", async ({ page }) => {
    test.skip(!locales.includes("ar"));
    await page.setViewportSize({ width: 390, height: 844 });
    for (const p of ["/ar/", toolPath("ar", "pdf-merger"), `/ar/${route("ar", "tools")}/`]) {
      await page.goto(p);
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, p).toBeLessThanOrEqual(1);
    }
  });

  test("long translations don't overflow on a phone (every locale, home + tool + all tools)", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    for (const l of others)
      for (const p of [`/${l.toLowerCase()}/`, toolPath(l, "image-compressor"), `/${l.toLowerCase()}/${route(l, "tools")}/`]) {
        await page.goto(p);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `${p} overflows by ${overflow}px`).toBeLessThanOrEqual(1);
      }
  });
});

test.describe("language selector", () => {
  test.skip(!locales.includes("de"), "German not built");

  test("searchable, keyboard-operable, opens the same page in the chosen language and remembers it", async ({ page }) => {
    await page.goto("/pdf-merger/");
    const sel = page.getByTestId("lang-select");
    await sel.locator("button").click();
    const input = sel.getByRole("combobox");
    await expect(input).toBeFocused();
    await input.fill("deut");
    await expect(sel.getByRole("option")).toHaveCount(1);
    await expect(sel.getByRole("option").first()).toContainText("Deutsch");
    await input.press("Enter");
    await page.waitForURL(`**${toolPath("de", "pdf-merger")}`);
    await expect(page.locator("html")).toHaveAttribute("lang", "de");
    expect(await page.evaluate(() => localStorage.getItem("ytx-locale"))).toBe("de");
    // Back to English through the selector, keyboard only.
    await page.getByTestId("lang-select").locator("button").click();
    await page.getByTestId("lang-select").getByRole("combobox").fill("English");
    await page.keyboard.press("Enter");
    await page.waitForURL("**/pdf-merger/");
  });

  test("native names, machine-translation badge, current language marked", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("lang-select").locator("button").click();
    const opts = page.getByTestId("lang-select").getByRole("option");
    await expect(opts).toHaveCount(locales.length);
    await expect(opts.filter({ hasText: "English" })).toHaveAttribute("aria-selected", "true");
    if (locales.includes("ar")) await expect(opts.filter({ hasText: "العربية" }).locator(".lang-native")).toHaveAttribute("dir", "rtl");
    await expect(opts.filter({ hasText: "Deutsch" }).locator(".lang-badge")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("lang-select").getByRole("listbox")).toHaveCount(0);
  });
});

test.describe("browser-language suggestion", () => {
  test.skip(!locales.includes("es"), "Spanish not built");
  test.use({ locale: "es-ES" });

  test("suggests, in Spanish, never redirects", async ({ page }) => {
    await page.goto("/pdf-merger/");
    expect(new URL(page.url()).pathname).toBe("/pdf-merger/");
    const banner = page.getByTestId("lang-suggest");
    await expect(banner).toBeVisible();
    await expect(banner).toHaveAttribute("lang", "es");
    await expect(banner.getByRole("link")).toHaveAttribute("href", toolPath("es", "pdf-merger"));
    await banner.getByRole("button").click();
    await page.reload();
    await expect(page.getByTestId("lang-suggest")).toHaveCount(0);
  });
});

// ── Static crawl of the whole export ──

function htmlFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "_next" || e.name === "admin" || e.name === "_none" ? [] : htmlFiles(p);
    return e.name === "index.html" ? [p] : [];
  });
}
const attr = (tag: string, name: string) => tag.match(new RegExp(`${name}="([^"]*)"`))?.[1];

test("canonical, robots, lang and hreflang are consistent on every page; hreflang is reciprocal", () => {
  const pages = new Map<string, { canonical?: string; noindex: boolean; lang?: string; alts: Map<string, string> }>();
  for (const f of htmlFiles(ROOT)) {
    const rel = "/" + path.relative(ROOT, path.dirname(f)).split(path.sep).filter(Boolean).join("/") + "/";
    const html = fs.readFileSync(f, "utf8");
    const canonical = attr(html.match(/<link[^>]+rel="canonical"[^>]*>/)?.[0] ?? "", "href");
    const robots = attr(html.match(/<meta[^>]+name="robots"[^>]*>/)?.[0] ?? "", "content") ?? "";
    const alts = new Map<string, string>();
    for (const m of html.matchAll(/<link[^>]+rel="alternate"[^>]+hrefLang="([^"]+)"[^>]*>/gi)) alts.set(m[1], attr(m[0], "href")!);
    pages.set(rel.replace(/^\/\/$/, "/"), { canonical, noindex: /noindex/.test(robots), lang: html.match(/<html[^>]* lang="([^"]+)"/)?.[1], alts });
  }
  expect(pages.size).toBeGreaterThan(80);
  const problems: string[] = [];
  const pathOf = (u: string) => new URL(u, "https://yonixtools.com").pathname;
  for (const [p, info] of pages) {
    if (p === "/offline/" || /\/offline\/$/.test(p)) continue;
    if (!info.canonical) problems.push(`${p}: no canonical`);
    else if (pathOf(info.canonical) !== p) problems.push(`${p}: canonical ${info.canonical}`);
    const first = p.split("/")[1];
    const want = others.find((l) => l.toLowerCase() === first) ?? "en";
    if (info.lang !== want) problems.push(`${p}: lang=${info.lang}, expected ${want}`);
    if (info.noindex && info.alts.size) problems.push(`${p}: noindex page has hreflang alternates`);
    for (const [hl, href] of info.alts) {
      const target = pages.get(pathOf(href));
      if (!target) problems.push(`${p}: hreflang ${hl} → missing page ${href}`);
      else if (target.noindex) problems.push(`${p}: hreflang ${hl} → noindex page ${href}`);
      else if (![...target.alts.values()].map(pathOf).includes(p)) problems.push(`${p}: hreflang ${hl} → ${href} is not reciprocal`);
    }
    if (info.alts.size && !info.alts.has("x-default")) problems.push(`${p}: hreflang without x-default`);
  }
  expect(problems.slice(0, 30)).toEqual([]);

  // Sitemap: valid, only indexable canonical pages, and every listed URL exists.
  const xml = fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8");
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  expect(new Set(locs).size).toBe(locs.length);
  for (const u of locs) {
    const pg = pages.get(pathOf(u));
    expect(pg, `sitemap lists missing page ${u}`).toBeTruthy();
    expect(pg!.noindex, `sitemap lists noindex page ${u}`).toBe(false);
  }
  // Machine-translated (unreviewed) locales contribute nothing to the sitemap.
  for (const l of others) {
    const status = JSON.parse(fs.readFileSync(path.join(process.cwd(), "src", "i18n", "status", `${l}.json`), "utf8"));
    if (Object.keys(status.reviews ?? {}).length === 0) expect(locs.filter((u) => pathOf(u).startsWith(`/${l.toLowerCase()}/`)), l).toEqual([]);
  }
});
