import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { tools } from "../../src/lib/registry";
import { isAdTraffic } from "./helpers";

// Every browser tool, opened on a desktop and on a phone: the tool hydrates and
// shows its controls, the app logs no errors, and nothing is wider than the screen.
// (Each tool's own behaviour is covered in tools*.spec.ts.)
const browserTools = tools.filter((t) => t.runsIn === "browser");

async function check(page: Page, slug: string) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !isAdTraffic(m.location().url) && errors.push(m.text()));
  const res = await page.goto(`/${slug}/`);
  expect(res?.status()).toBe(200);
  await page.locator("html[data-tool-ready]").waitFor({ state: "attached", timeout: 15_000 });
  const surface = page.locator(".tool-surface");
  await expect(surface).toBeVisible();
  expect(await surface.locator("input, textarea, select, button").count(), `${slug}: no controls`).toBeGreaterThan(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${slug}: horizontal overflow`).toBeLessThanOrEqual(0);
  expect(errors, slug).toEqual([]);
}

test.describe("desktop", () => {
  test.use({ viewport: { width: 1366, height: 860 } });
  for (const t of browserTools) test(t.slug, async ({ page }) => check(page, t.slug));
});

test.describe("phone", () => {
  test.use({ viewport: { width: 375, height: 740 }, isMobile: true, hasTouch: true });
  for (const t of browserTools) test(t.slug, async ({ page }) => check(page, t.slug));
});

test("vCard QR: generated code downloads and decodes back to the contact", async ({ page }) => {
  await page.goto("/vcard-qr-code-generator/");
  await page.locator("html[data-tool-ready]").waitFor({ state: "attached" });
  await expect(page.getByRole("button", { name: "PNG" })).toBeDisabled(); // invalid: nothing entered
  await page.locator("#vc-firstName").fill("Ada");
  await page.locator("#vc-lastName").fill("Lovelace");
  await page.locator("#vc-email").fill("ada@example.com");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "PNG" }).click()]);
  expect(dl.suggestedFilename()).toBe("contact-Ada-Lovelace.png");
  const png = readFileSync((await dl.path())!);
  await page.goto("/qr-code-scanner/");
  await page.locator("html[data-tool-ready]").waitFor({ state: "attached" });
  await page.getByTestId("qr-input").setInputFiles({ name: "card.png", mimeType: "image/png", buffer: png });
  const text = await page.getByTestId("qr-result").textContent();
  expect(text).toContain("BEGIN:VCARD");
  expect(text).toContain("Lovelace;Ada");
  expect(text).toContain("ada@example.com");
});
