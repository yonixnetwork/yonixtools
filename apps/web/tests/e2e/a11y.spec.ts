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

test("open drawer and install invitation have no violations", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
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
  expect(await audit(page)).toEqual([]);
});
