import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

// Runs only against the REAL nginx config (scripts/nginx-local.sh, REAL_NGINX=1), where the
// production CSP and headers apply. Visits every built page and fails on any CSP violation.
// Ad networks are stubbed (their scripts load, draw nothing): no real ad traffic.
test.skip(!process.env.REAL_NGINX, "needs the real nginx config (REAL_NGINX=1)");

const out = new URL("../../out", import.meta.url).pathname;
const pages: string[] = [];
const walk = (d: string, base: string) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) { if (f !== "_next" && f !== "admin") walk(p, `${base}${f}/`); } // admin: password-protected, tested in admin.spec.ts
    else if (f === "index.html") pages.push(base);
  }
};
try { walk(out, "/"); } catch { /* no build */ }

test("no Content-Security-Policy violation on any page", async ({ page }) => {
  test.setTimeout(240_000);
  for (const host of ["https://n6wxm.com/**", "https://nap5k.com/**", "https://bellnewyork.org/**"])
    await page.route(host, (r) => r.fulfill({ contentType: "application/javascript", body: "" }));
  await page.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => (window as unknown as { __csp: string[] }).__csp.push(`${e.effectiveDirective} ${e.blockedURI}`));
  });
  const violations: string[] = [];
  page.on("console", (m) => /Content Security Policy/i.test(m.text()) && violations.push(`${page.url()} console: ${m.text().slice(0, 160)}`));
  expect(pages.length).toBeGreaterThan(60);
  for (const path of pages) {
    await page.goto(path, { waitUntil: "load" });
    await page.waitForTimeout(250);
    const v = await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);
    for (const x of v) violations.push(`${path} ${x}`);
  }
  expect(violations).toEqual([]);
});
