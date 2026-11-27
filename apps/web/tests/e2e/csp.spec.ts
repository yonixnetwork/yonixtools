import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { readFileSync as readPolicy } from "node:fs";
import { expect, test } from "@playwright/test";
const policy = JSON.parse(readPolicy(new URL("../../src/lib/ads/ads-policy.json", import.meta.url), "utf8")) as { version: number };

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

// One test per language (first path segment), so every page of every locale is covered within time
// limits and the groups run in parallel. English pages (no locale prefix) form one group.
const LOCALE_PREFIXES = new Set(["es", "pt-br", "fr", "de", "hi", "id", "ar", "zh-cn", "ja", "ru", "bn", "ur", "tr", "vi", "ko", "it", "nl", "th", "sw"]);
const groups = new Map<string, string[]>();
for (const p of pages) {
  const first = p.split("/")[1] ?? "";
  const key = LOCALE_PREFIXES.has(first) ? first : "en";
  groups.set(key, [...(groups.get(key) ?? []), p]);
}

test("every built page is covered", () => {
  expect(pages.length).toBeGreaterThan(60);
  expect([...groups.values()].reduce((n, g) => n + g.length, 0)).toBe(pages.length);
});

for (const [group, list] of groups) {
  test(`no Content-Security-Policy violation on any page (${group}, ${list.length} pages)`, async ({ page }) => {
    test.setTimeout(300_000);
    for (const host of ["https://n6wxm.com/**", "https://nap5k.com/**", "https://bellnewyork.org/**"])
      await page.route(host, (r) => r.fulfill({ contentType: "application/javascript", body: "" }));
    // No backend behind this nginx: answer the per-page-view ad eligibility check so the (test-override)
    // ad frames are really embedded and covered by the CSP check.
    await page.route("**/api/v1/ad-eligibility", (r) => r.fulfill({ json: { eligible: true, reason: "eligible", country: null, policyVersion: policy.version } }));
    await page.addInitScript(() => {
      (window as unknown as { __csp: string[] }).__csp = [];
      document.addEventListener("securitypolicyviolation", (e) => (window as unknown as { __csp: string[] }).__csp.push(`${e.effectiveDirective} ${e.blockedURI}`));
    });
    const violations: string[] = [];
    page.on("console", (m) => /Content Security Policy/i.test(m.text()) && violations.push(`${page.url()} console: ${m.text().slice(0, 160)}`));
    for (const path of list) {
      await page.goto(path, { waitUntil: "load" });
      await page.waitForTimeout(150);
      const v = await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);
      for (const x of v) violations.push(`${path} ${x}`);
    }
    expect(violations).toEqual([]);
  });
}
