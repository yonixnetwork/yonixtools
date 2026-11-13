import { expect, test } from "@playwright/test";

// Server-side authorization, tested against the REAL nginx config (scripts/nginx-local.sh,
// REAL_NGINX=1, with ADMIN_HTPASSWD set). The plain test server has no auth, so skip there.
test.skip(!process.env.REAL_NGINX, "needs the real nginx config (REAL_NGINX=1)");
const USER = process.env.ADMIN_USER || "", PASS = process.env.ADMIN_PASS || "";
const basic = (u: string, p: string) => ({ Authorization: "Basic " + Buffer.from(`${u}:${p}`).toString("base64") });

test("the admin test page rejects visitors and wrong passwords, server-side", async ({ request }) => {
  for (const path of ["/admin/ads/", "/admin/ads/index.html", "/admin/"]) {
    const r = await request.get(path);
    expect(r.status(), path).toBe(401);
    expect(await r.text(), path).not.toContain("Ad delivery test");
  }
  expect((await request.get("/admin/ads/", { headers: basic(USER || "admin", "wrong-password") })).status()).toBe(401);
  expect((await request.get("/admin/ads/", { headers: basic("nobody", PASS || "x") })).status()).toBe(401);
});

test("with the admin login: page served, never cached, never indexed", async ({ request }) => {
  test.skip(!USER || !PASS, "ADMIN_USER/ADMIN_PASS not set");
  const r = await request.get("/admin/ads/", { headers: basic(USER, PASS) });
  expect(r.status()).toBe(200);
  expect(await r.text()).toContain("Ad delivery test (admin only)");
  expect(r.headers()["cache-control"]).toBe("no-store");
  expect(r.headers()["x-robots-tag"]).toContain("noindex");
  expect(r.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
});

test("admin page in a browser: each format reports its real state", async ({ browser }) => {
  test.skip(!USER || !PASS, "ADMIN_USER/ADMIN_PASS not set");
  const ctx = await browser.newContext({ httpCredentials: { username: USER, password: PASS } });
  const page = await ctx.newPage();
  // Stubs only (no ad traffic): one banner gets a creative, the rest run and return nothing.
  await page.route("https://bellnewyork.org/**", (r) => r.fulfill({ contentType: "application/javascript", body: "" }));
  await page.route("https://bellnewyork.org/22/620b3190e30ed523091b51770aea0b40", (r) => r.fulfill({ contentType: "application/javascript",
    body: `document.write('<a href="https://example.com"><img width="300" height="250" src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22250%22/%3E"></a>')` }));
  for (const h of ["https://n6wxm.com/**", "https://nap5k.com/**"]) await page.route(h, (r) => r.abort("blockedbyclient"));
  await page.goto("/admin/ads/");
  const report = page.locator("#report");
  await expect(report).toContainText("Adsterra banner 300 × 250: AD RENDERED", { timeout: 15_000 });
  await expect(report).toContainText("Adsterra banner 320 × 50: EMPTY: no creative returned", { timeout: 15_000 });
  await expect(report).toContainText(process.env.NEXT_PUBLIC_MONETAG === "on" ? "Monetag In-Page Push (zone 12218944): BLOCKED" : "Monetag In-Page Push (zone 12218944): DISABLED (MONETAG=off)", { timeout: 20_000 });
  await expect(report).not.toContainText("scripts:"); // the public frame sends no diagnostics
  await expect(page.locator("#adtest")).toHaveAttribute("href", "http://localhost:4175/ad-test.html");
  await ctx.close();
});

test("removed or internal routes are not exposed to visitors", async ({ request }) => {
  expect((await request.get("/ads-check/")).status()).toBe(404);
  expect((await request.get("/api/internal/stats")).status()).toBe(404);
  const ready = await request.get("/api/readyz");
  expect(await ready.text()).not.toContain("checks"); // no internal health details (or 502 without a local backend)
});

// Delivery counts: only the password-protected /admin/ location may reach the backend's stats,
// and a visitor can't forge the header that location adds. A local echo server stands in for
// the backend (start nginx with API_UPSTREAM=127.0.0.1:$API_ECHO_PORT).
test.describe("admin delivery counts", () => {
  const port = Number(process.env.API_ECHO_PORT || 0);
  test.skip(!port, "API_ECHO_PORT not set");
  let server: import("node:http").Server;
  test.beforeAll(async () => {
    const http = await import("node:http");
    server = http.createServer((req, res) => { res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ path: req.url, admin: req.headers["x-ytx-admin"] ?? null })); });
    await new Promise<void>((r) => server.listen(port, "127.0.0.1", () => r()));
  });
  test.afterAll(() => new Promise<void>((r) => server.close(() => r())));

  test("visitors can't reach them or forge the admin header; the admin login can", async ({ request }) => {
    expect((await request.get("/admin/api/ad-stats")).status()).toBe(401);
    const forged = await (await request.get("/api/v1/ad-stats", { headers: { "X-Ytx-Admin": "nginx-admin-auth" } })).json();
    expect(forged).toEqual({ path: "/v1/ad-stats", admin: null }); // removed by nginx: the backend answers 404
    test.skip(!USER || !PASS, "ADMIN_USER/ADMIN_PASS not set");
    const r = await request.get("/admin/api/ad-stats", { headers: basic(USER, PASS) });
    expect(r.status()).toBe(200);
    expect(await r.json()).toEqual({ path: "/v1/ad-stats", admin: "nginx-admin-auth" });
  });
});

// ── The ad documents only on the ad origin (Gap 1) and the protected ad test (Gap 2), through the
//    REAL nginx config: :4173 is the site, :4175 the ad origin (Host header localhost:4175). ──
const SITE = "http://localhost:4173", AD = "http://localhost:4175";

test("the site origin never serves the ad documents, under any spelling, query or login", async ({ request }) => {
  for (const p of ["/ad-frame.html", "/ad-test.html", "/ad-frame.html?u=native&s=x", "/ad-test.html?u=monetagPush", "/ad-frame.html/", "/ad-test", "/ad-frame"]) {
    expect((await request.get(SITE + p)).status(), p).toBe(404);
    if (USER) expect((await request.get(SITE + p, { headers: basic(USER, PASS) })).status(), p + " with login").toBe(404);
  }
});

test("the ad origin serves the public frame and the protected test, and nothing else", async ({ request }) => {
  const f = await request.get(AD + "/ad-frame.html");
  expect(f.status()).toBe(200);
  const body = await f.text();
  expect(body).toContain("bellnewyork.org/22/620b3190e30ed523091b51770aea0b40");
  expect(body).not.toMatch(/data-ytx-ui|__ytxReport|admin-top|ytxTest|performance\.getEntries/); // no diagnostics in the public frame
  for (const p of ["/", "/tools/", "/admin/ads/", "/api/healthz", "/sw.js", "/manifest.webmanifest", "/ad-frame", "/ad-test.html/x"]) expect((await request.get(AD + p)).status(), p).toBe(404);
  for (const p of ["/ad-test.html", "/ad-test.html?u=monetagPush", "/ad-test.html?u=monetagPush&embed=1"]) {
    const r = await request.get(AD + p);
    expect(r.status(), p).toBe(401);
    expect(await r.text(), p).not.toContain("__ytxReport");
  }
  expect((await request.get(AD + "/ad-test.html", { headers: basic(USER || "admin", "wrong-password") })).status()).toBe(401);
});

test("with the admin login: the ad test is served, never cached or indexed", async ({ request }) => {
  test.skip(!USER || !PASS, "ADMIN_USER/ADMIN_PASS not set");
  const r = await request.get(AD + "/ad-test.html", { headers: basic(USER, PASS) });
  expect(r.status()).toBe(200);
  expect(await r.text()).toContain("__ytxReport");
  expect(r.headers()["cache-control"]).toBe("no-store");
  expect(r.headers()["x-robots-tag"]).toContain("noindex");
  expect(r.headers()["content-security-policy"]).toContain("frame-ancestors 'self';");
});

test("ad test in a browser: Monetag In-Page Push as a separate top-level document on the ad origin", async ({ browser }) => {
  test.skip(!USER || !PASS, "ADMIN_USER/ADMIN_PASS not set");
  const ctx = await browser.newContext({ httpCredentials: { username: USER, password: PASS } });
  const page = await ctx.newPage();
  await page.route("https://nap5k.com/**", (r) => r.fulfill({ contentType: "application/javascript", body: "var d=document.createElement('div');d.style.cssText='width:320px;height:90px;background:#ccc';d.textContent='Sponsored message from a test';document.body.appendChild(d);" }));
  await page.goto(AD + "/ad-test.html?u=monetagPush");
  const panel = page.locator("pre[data-ytx-ui]");
  await expect(panel).toContainText("CREATIVE RENDERED", { timeout: 10_000 });
  await expect(panel).toContainText("separate top-level document on http://localhost:4175");
  await expect(panel).toContainText("nap5k.com/tag.min.js loaded");
  await ctx.close();
});
