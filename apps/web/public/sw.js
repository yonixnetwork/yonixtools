/* YoniXTools service worker.
 *
 * - App shell + offline page are precached per version (?v=<build> on the script URL).
 * - Hashed build assets (/_next/static/) are cache-first: their URLs change on every deploy.
 * - Pages are network-first (always fresh when online), with the last copy or the
 *   offline page as fallback.
 * - Never touched: /api/ (extraction, previews, downloads), non-GET requests,
 *   range requests, the advertising frame and anything on another origin.
 */
const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const SHELL = `ytx-shell-${VERSION}`;
const PAGES = `ytx-pages-${VERSION}`;
const STATIC = "ytx-static";
const PRECACHE = ["/", "/offline/", "/tools/", "/manifest.webmanifest", "/favicon.svg", "/icons/icon-192.png", "/icons/icon-512.png"];
const MAX_PAGES = 40;
const MAX_STATIC = 300;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then((c) => c.addAll(PRECACHE.map((u) => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("ytx-") && k !== SHELL && k !== PAGES && k !== STATIC).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(name, max) {
  const c = await caches.open(name);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}

async function page(request) {
  try {
    const res = await fetch(request);
    if (res.ok && (res.headers.get("content-type") || "").includes("text/html")) {
      const copy = res.clone();
      caches.open(PAGES).then((c) => c.put(request, copy)).then(() => trim(PAGES, MAX_PAGES));
    }
    return res;
  } catch {
    return (await caches.match(request, { ignoreSearch: true })) || (await caches.match("/offline/")) || Response.error();
  }
}

async function asset(request) {
  const hit = await caches.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) {
    const copy = res.clone();
    caches.open(STATIC).then((c) => c.put(request, copy)).then(() => trim(STATIC, MAX_STATIC));
  }
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || req.headers.has("range")) return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // ads and other sites: untouched
  if (url.pathname.startsWith("/api/")) return; // live extraction and downloads: never cached
  if (url.pathname === "/ad-frame.html") return; // advertising: always straight from the network
  if (req.mode === "navigate") return event.respondWith(page(req));
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname === "/favicon.svg") return event.respondWith(asset(req));
});
