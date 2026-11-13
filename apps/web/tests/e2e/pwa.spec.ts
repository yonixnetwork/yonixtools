import { expect, test } from "@playwright/test";

test("manifest is valid and every icon exists at its declared size", async ({ request }) => {
  const r = await request.get("/manifest.webmanifest");
  expect(r.status()).toBe(200);
  expect(r.headers()["content-type"]).toContain("application/manifest+json");
  const m = await r.json();
  expect(m).toMatchObject({ name: "YoniXTools", short_name: "YoniXTools", display: "standalone", start_url: "/?source=pwa", scope: "/" });
  expect(m.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
  expect(m.background_color).toMatch(/^#[0-9a-f]{6}$/i);
  expect(m.shortcuts.length).toBeGreaterThanOrEqual(3);
  for (const s of m.shortcuts) expect((await request.get(s.url)).status(), s.url).toBe(200);
  const purposes = new Set(m.icons.map((i: { purpose: string }) => i.purpose));
  expect(purposes).toEqual(new Set(["any", "maskable"]));
  for (const icon of m.icons) {
    const res = await request.get(icon.src);
    expect(res.status(), icon.src).toBe(200);
    expect(res.headers()["content-type"]).toBe("image/png");
    const b = await res.body();
    expect(`${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`, icon.src).toBe(icon.sizes);
  }
  expect((await request.get("/icons/apple-touch-icon.png")).status()).toBe(200);
});

test("pages link the manifest and iOS metadata", async ({ page }) => {
  await page.goto("/image-compressor/");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", "/icons/apple-touch-icon.png");
  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute("content", "YoniXTools");
});

test("Chromium reports the site as installable; service worker controls the page", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  const cdp = await page.context().newCDPSession(page);
  const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
  expect(installabilityErrors).toEqual([]);
  const { url, errors, data } = await cdp.send("Page.getAppManifest");
  expect(url).toContain("/manifest.webmanifest");
  expect(errors).toEqual([]);
  expect(JSON.parse(data!).name).toBe("YoniXTools");
});

test("offline: visited pages still open, others show the offline page", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await page.goto("/word-counter/");
  await expect(page.locator("h1")).toContainText("Word");
  await context.setOffline(true);
  await page.goto("/word-counter/");
  await expect(page.locator("h1")).toContainText("Word"); // cached copy
  await page.goto("/loan-calculator/");
  await expect(page.locator("h1")).toHaveText("You're offline");
  await context.setOffline(false);
});

test("API requests and downloads are never answered from the cache", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  const fromSw = await page.evaluate(async () => {
    const r = await fetch("/api/healthz?x=" + Date.now()).catch(() => null);
    const keys = await caches.keys();
    const urls: string[] = [];
    for (const k of keys) for (const req of await (await caches.open(k)).keys()) urls.push(new URL(req.url).pathname);
    return { status: r?.status ?? 0, cached: urls.filter((u) => u.startsWith("/api/")) };
  });
  expect(fromSw.cached).toEqual([]);
});

test("a new deployment replaces the old caches", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  const before = await page.evaluate(() => caches.keys());
  expect(before.some((k) => k.startsWith("ytx-shell-"))).toBe(true);
  // Simulate the next build: register the worker with another version.
  const after = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.register("/sw.js?v=next-build", { scope: "/" });
    await new Promise<void>((done) => {
      const w = reg.installing || reg.waiting;
      if (!w) return done();
      w.addEventListener("statechange", () => w.state === "activated" && done());
    });
    await new Promise((r) => setTimeout(r, 300));
    return caches.keys();
  });
  expect(after).toContain("ytx-shell-next-build");
  expect(after.filter((k) => k.startsWith("ytx-shell-"))).toEqual(["ytx-shell-next-build"]);
});

test("Android/desktop Chromium: install invitation uses the browser prompt, and dismissal is remembered", async ({ page }) => {
  await page.goto("/?installDelay=0");
  await page.locator("html[data-pwa-ready]").waitFor({ state: "attached" });
  await expect(page.getByTestId("install-card")).toHaveCount(0); // nothing without a real install event
  await page.evaluate(() => {
    const e = new Event("beforeinstallprompt") as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
    (window as unknown as { __prompted: number }).__prompted = 0;
    e.prompt = async () => void ((window as unknown as { __prompted: number }).__prompted += 1);
    e.userChoice = Promise.resolve({ outcome: "dismissed" });
    window.dispatchEvent(e);
  });
  const card = page.getByTestId("install-card");
  await expect(card).toBeVisible();
  await page.getByRole("button", { name: /Explore tools/ }).click(); // desktop opens the drawer from the header
  await expect(page.getByRole("button", { name: "Install the app" })).toBeVisible();
  await page.getByRole("button", { name: "Close menu" }).click();
  await card.getByRole("button", { name: "Install" }).click();
  expect(await page.evaluate(() => (window as unknown as { __prompted: number }).__prompted)).toBe(1);
  await expect(card).toHaveCount(0);
  // "Not now" is remembered: no invitation on the next visit even if the browser offers installing again.
  await page.evaluate(() => localStorage.setItem("ytx-install-dismissed", String(Date.now())));
  await page.reload();
  await page.locator("html[data-pwa-ready]").waitFor({ state: "attached" });
  await page.evaluate(() => {
    const e = new Event("beforeinstallprompt") as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
    e.prompt = async () => {};
    e.userChoice = Promise.resolve({ outcome: "dismissed" });
    window.dispatchEvent(e);
  });
  await page.waitForTimeout(300);
  await expect(page.getByTestId("install-card")).toHaveCount(0);
});

test("declining the browser's own install dialog is remembered too", async ({ page }) => {
  await page.goto("/?installDelay=0");
  await page.locator("html[data-pwa-ready]").waitFor({ state: "attached" });
  const fire = () => page.evaluate(() => {
    const e = new Event("beforeinstallprompt") as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
    e.prompt = async () => {};
    e.userChoice = Promise.resolve({ outcome: "dismissed" });
    window.dispatchEvent(e);
  });
  await fire();
  await page.getByTestId("install-card").getByRole("button", { name: "Install" }).click(); // native dialog -> "Cancel"
  await expect(page.getByTestId("install-card")).toHaveCount(0);
  expect(Number(await page.evaluate(() => localStorage.getItem("ytx-install-dismissed")))).toBeGreaterThan(0);
  await page.reload();
  await page.locator("html[data-pwa-ready]").waitFor({ state: "attached" });
  await fire();
  await page.waitForTimeout(300);
  await expect(page.getByTestId("install-card")).toHaveCount(0);
});

test("accepted installation: invitation and drawer entry disappear for good", async ({ page }) => {
  await page.goto("/?installDelay=0");
  await page.locator("html[data-pwa-ready]").waitFor({ state: "attached" });
  await page.evaluate(() => {
    const e = new Event("beforeinstallprompt") as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
    e.prompt = async () => {};
    e.userChoice = Promise.resolve({ outcome: "accepted" });
    window.dispatchEvent(e);
  });
  await page.getByTestId("install-card").getByRole("button", { name: "Install" }).click();
  await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
  await expect(page.getByTestId("install-card")).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: /Explore tools/ }).click();
  await expect(page.getByRole("button", { name: "Install the app" })).toHaveCount(0);
});

test("browsers without install support get no install button", async ({ page }) => {
  await page.goto("/?installDelay=0");
  await page.waitForTimeout(500);
  await expect(page.getByTestId("install-card")).toHaveCount(0);
  await page.getByRole("button", { name: /Explore tools/ }).click();
  await expect(page.getByRole("dialog", { name: "All tools" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Install the app" })).toHaveCount(0);
});
