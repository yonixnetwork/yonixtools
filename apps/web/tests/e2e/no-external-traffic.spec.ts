import { expect, test } from "@playwright/test";

// Guard for the rule in playwright.config.ts: tests can't reach external servers, so they
// can never generate ad requests or impressions. A page with ads is opened WITHOUT stubs.
test("automated tests never reach the ad networks (or any external host)", async ({ page }) => {
  const reached: string[] = [];
  page.on("response", (r) => { if (!/^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(r.url()) && !r.url().startsWith("data:")) reached.push(`${r.status()} ${r.url()}`); });
  await page.goto("/pdf-merger/"); // Adsterra slots + Monetag zones (when enabled)
  for (const a of await page.locator("aside.ad-slot").all()) await a.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(3000);
  expect(reached).toEqual([]);
  const r = await page.evaluate(() => fetch("https://n6wxm.com/vignette.min.js", { mode: "no-cors" }).then(() => "reached", () => "blocked"));
  expect(r).toBe("blocked");
});
