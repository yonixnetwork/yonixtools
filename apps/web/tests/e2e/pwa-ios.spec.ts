import { expect, test } from "@playwright/test";

// iPhone emulation (Safari user agent). Safari has no install prompt: we show the Share → Add to Home Screen guide.
test("iPhone Safari: guide to Add to Home Screen, never a fake Install button", async ({ page }) => {
  await page.goto("/?installDelay=0");
  const card = page.getByTestId("install-card");
  await expect(card).toBeVisible();
  await expect(card.getByRole("button", { name: "Install", exact: true })).toHaveCount(0);
  await card.getByRole("button", { name: "How to install" }).click();
  const guide = page.getByRole("dialog", { name: "Install YoniXTools on iPhone or iPad" });
  await expect(guide).toContainText("Add to Home Screen");
  await expect(guide).toContainText("Share");
});

test("iPad (reports a Mac user agent, has touch): same guide", async ({ browser }) => {
  const ctx = await browser.newContext({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15", hasTouch: true, viewport: { width: 1024, height: 1366 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => Object.defineProperty(navigator, "maxTouchPoints", { get: () => 5 })); // real iPads report 5; Chromium's touch emulation reports 1
  await page.goto("/?installDelay=0");
  await expect(page.getByTestId("install-card")).toBeVisible();
  await page.getByRole("button", { name: "How to install" }).click();
  await expect(page.getByRole("dialog", { name: "Install YoniXTools on iPhone or iPad" })).toContainText("in Safari's toolbar");
  await ctx.close();
});

test("Chrome on iPhone: instructions for Chrome's Share button, no fake Install button", async ({ browser }) => {
  const ctx = await browser.newContext({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.6367.71 Mobile/15E148 Safari/604.1", hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto("/?installDelay=0");
  const card = page.getByTestId("install-card");
  await expect(card).toBeVisible();
  await expect(card.getByRole("button", { name: "Install", exact: true })).toHaveCount(0);
  await card.getByRole("button", { name: "How to install" }).click();
  await expect(page.getByRole("dialog", { name: "Install YoniXTools on iPhone or iPad" })).toContainText("in Chrome's address bar");
  await ctx.close();
});

test("installed (opened from the Home Screen): no invitation, no drawer entry", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "standalone", { get: () => true }));
  await page.goto("/?installDelay=0");
  await page.waitForTimeout(600);
  await expect(page.getByTestId("install-card")).toHaveCount(0);
});
