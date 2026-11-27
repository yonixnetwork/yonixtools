import fs from "node:fs";
import nodePath from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// WCAG 2.1 A/AA automated checks (axe-core) on the main page types and overlays.
// Third-party ad frames are excluded: their content isn't ours.
async function audit(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).exclude(".ad-frame").analyze();
  return r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
}

for (const [name, path] of [["home", "/"], ["tool page", "/image-compressor/"], ["downloader page", "/instagram-downloader/"], ["all tools", "/tools/"], ["category", "/category/pdf-tools/"], ["help", "/about/"], ["privacy", "/privacy/"]]) {
  test(`${name} has no WCAG A/AA violations`, async ({ page }) => {
    await page.goto(path);
    await page.waitForTimeout(500);
    expect(await audit(page)).toEqual([]);
  });
}

// Localized pages, including right-to-left (Arabic, Urdu) and complex scripts, plus the open
// language selector. Paths come from the catalogues (translated slugs).
const slugOf = (l: string, slug: string) => {
  const f = nodePath.join(process.cwd(), "src", "i18n", "messages", l, "registry.json");
  return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, "utf8"))[`tool.${slug}.slug`] as string) ?? slug : slug;
};
for (const l of ["es", "de", "ar", "ur", "hi", "ja", "th"]) {
  if (!fs.existsSync(nodePath.join(process.cwd(), "out", l.toLowerCase(), "index.html"))) continue;
  for (const p of [`/${l.toLowerCase()}/`, `/${l.toLowerCase()}/${slugOf(l, "image-compressor")}/`]) {
    test(`localized ${p} has no WCAG A/AA violations`, async ({ page }) => {
      await page.goto(p);
      await page.waitForTimeout(500);
      expect(await audit(page)).toEqual([]);
    });
  }
}

test("open language selector has no violations", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("lang-select").locator("button").click();
  await expect(page.getByTestId("lang-select").getByRole("listbox")).toBeVisible();
  expect(await audit(page)).toEqual([]);
});

test("open drawer and install invitation have no violations", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // Measure the settled UI, not the 0.2 s slide/fade-in (axe would sample half-transparent text).
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?installDelay=0");
  await page.locator("html[data-pwa-ready]").waitFor({ state: "attached" });
  await page.evaluate(() => {
    const e = new Event("beforeinstallprompt") as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
    e.prompt = async () => {};
    e.userChoice = Promise.resolve({ outcome: "dismissed" });
    window.dispatchEvent(e);
  });
  await expect(page.getByTestId("install-card")).toBeVisible();
  expect(await audit(page)).toEqual([]);
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.locator("#tools-drawer")).toBeVisible();
  await page.waitForTimeout(300);
  expect(await audit(page)).toEqual([]);
});

for (const path of ["/", "/image-compressor/", "/instagram-downloader/"]) {
  test(`dark theme ${path} has no WCAG A/AA violations`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await page.goto(path);
    await page.waitForTimeout(500);
    expect(await audit(page)).toEqual([]);
  });
}
