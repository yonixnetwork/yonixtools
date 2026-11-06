import { expect, test } from "@playwright/test";
import { categories, tools } from "../../src/lib/registry";

const SITE = "https://yonixtools.com";

test.describe("every tool landing page", () => {
  const titles = new Set<string>();
  for (const tool of tools) {
    test(`${tool.slug}: renders, unique metadata, structured data`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      const res = await page.goto(`/${tool.slug}/`);
      expect(res?.status()).toBe(200);

      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("h1")).toHaveText(tool.name);
      const title = await page.title();
      expect(title).toContain(tool.seo.title);
      expect(titles.has(title)).toBe(false);
      titles.add(title);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", tool.seo.description);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${SITE}/${tool.slug}/`);
      await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", `${SITE}/${tool.slug}/`);
      const robots = await page.locator('meta[name="robots"]').getAttribute("content");
      if (tool.status === "live") expect(robots).toMatch(/^index/);
      else expect(robots).toMatch(/^noindex/);

      const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
      const types = ld.map((s) => JSON.parse(s)["@type"]);
      expect(types).toEqual(expect.arrayContaining(["WebApplication", "BreadcrumbList", "FAQPage"]));

      await expect(page.locator("h2", { hasText: "How to use" })).toBeVisible();
      await expect(page.locator(".breadcrumbs li")).toHaveCount(3);
      expect(await page.locator(".related-list a").count()).toBeGreaterThanOrEqual(2);

      if (tool.category === "social") await expect(page.locator("#dl-url")).toBeVisible();
      else await expect(page.locator(".tool-surface :is(input, textarea, select, button, [role=button])").first()).toBeVisible();
      expect(errors, errors.join("\n")).toEqual([]);
    });
  }
});

test("sitemap lists live pages only and robots.txt points to it", async ({ request }) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  for (const t of tools) {
    const listed = xml.includes(`<loc>${SITE}/${t.slug}/</loc>`);
    expect(listed, t.slug).toBe(t.status === "live");
  }
  for (const c of categories) expect(xml).toContain(`${SITE}/category/${c.slug}/`);
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain(`Sitemap: ${SITE}/sitemap.xml`);
});

test("category pages and 404", async ({ page }) => {
  for (const c of categories) {
    await page.goto(`/category/${c.slug}/`);
    await expect(page.locator("h1")).toHaveText(c.name);
  }
  const res = await page.goto("/definitely-not-a-tool/");
  expect(res?.status()).toBe(404);
  await expect(page.locator("h1")).toHaveText("Page not found");
});
