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
