// Isolation check of the Adsterra ad frame, served by the REAL nginx config
// (scripts/nginx-local.sh). Local only; the ad network's scripts are replaced by
// stubs (a "hostile creative" and a legitimate one). Nothing contacts an ad network.
//
//   node scripts/ads/verify-isolation.mjs <label> <siteOrigin> <adOrigin>
// The build in ./out must have been made with NEXT_PUBLIC_AD_ORIGIN=<adOrigin> (or empty
// for the same-origin baseline), and nginx must serve it on both ports.
import { chromium } from "playwright";

const [label, SITE, ADS] = process.argv.slice(2);
const UNIT = "https://bellnewyork.org/22/087c1ea1a028c67071c19090b33ca01b"; // 728x90 leaderboard on downloader pages

// Runs inside the ad frame. Each attempt is reported, never assumed.
const hostile = `
var r = { origin: self.origin }, P = parent;
function t(k, f) { try { r[k] = f(); } catch (e) { r[k] = "BLOCKED (" + e.name + ")"; } }
t("readPastedUrl", function () { return P.document.getElementById("dl-url").value; });
t("readPageDom", function () { return P.document.title; });
t("readTopUrl", function () { return top.location.href; });
t("injectScriptIntoPage", function () { var s = P.document.createElement("script"); s.textContent = "location.href='https://example.org/hijack'"; P.document.body.appendChild(s); return "INJECTED"; });
t("navigateTopFromFrame", function () { top.location.href = "https://example.org/topnav"; return "attempted"; });
t("pageCookiesVisible", function () { return document.cookie; });
t("setCookies", function () { document.cookie = "frame_set=f1; path=/"; document.cookie = "tossed=t1; domain=localhost; path=/"; return "set"; });
t("pageLocalStorageVisible", function () { return localStorage.getItem("site_ls"); });
t("setLocalStorage", function () { localStorage.setItem("frame_ls", "f"); return "set"; });
t("spoofOtherSlot", function () { P.postMessage({ ytxAd: "R1", state: "filled", height: 900 }, "*"); P.postMessage({ ytxAd: "native", state: "filled", height: 900 }, "*"); return "sent"; });
r.swRegister = "pending";
try { navigator.serviceWorker.register("/sw.js").then(function (g) { r.swRegister = "registered on " + new URL(g.scope).origin; }, function (e) { r.swRegister = "rejected: " + e.name; }); } catch (e) { r.swRegister = "BLOCKED (" + e.name + ")"; }
document.write('<a id="pop" href="https://example.org/pop" target="_blank" style="display:block;width:728px;height:90px;background:#ccc">ad</a>');
window.__r = r;`;
const legit = `document.write('<a href="https://example.com"><img width="728" height="90" src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22728%22 height=%2290%22%3E%3Crect width=%22728%22 height=%2290%22 fill=%22%23ccc%22/%3E%3C/svg%3E"></a>')`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.route("https://example.org/**", (r) => r.fulfill({ contentType: "text/html", body: "<title>other site</title>" }));
await ctx.route("https://bellnewyork.org/**", (r) => r.fulfill({ contentType: "application/javascript", body: "" }));
const out = { label, site: SITE, adOrigin: ADS };

// Headers as nginx sends them.
const ph = (await (await fetch(SITE + "/instagram-downloader/")).headers.get("content-security-policy")) || "";
const fh = await fetch(ADS + "/ad-frame.html");
out.pageCspFrameSrc = (ph.match(/frame-src [^;]+/) || ["(none: default-src 'self')"])[0];
out.adFrameCspAncestors = ((fh.headers.get("content-security-policy") || "").match(/frame-ancestors [^;]+/) || ["(none)"])[0];
out.adFrameXFrameOptions = fh.headers.get("x-frame-options") || "(none)";

// 1. Hostile creative on a downloader page, after a visitor pasted a URL.
{
  const page = await ctx.newPage();
  await page.route(UNIT, (r) => r.fulfill({ contentType: "application/javascript", body: hostile }));
  await page.goto(SITE + "/instagram-downloader/");
  await page.evaluate(() => { document.cookie = "site_secret=s1; path=/"; localStorage.setItem("site_ls", "s"); });
  await page.locator("#dl-url").fill("https://www.instagram.com/p/PRIVATE-TEST-URL/");
  const swBefore = await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length);
  const slot = page.locator('aside[data-ad-unit="banner728x90"]');
  await slot.scrollIntoViewIfNeeded();
  await page.waitForTimeout(3500);
  const frame = page.frames().find((f) => f.url().includes("u=banner728x90"));
  out.iframeSandbox = await slot.locator("iframe").getAttribute("sandbox");
  out.frameSrc = frame?.url().split("?")[0];
  out.inFrame = frame ? await frame.evaluate(() => window.__r) : "frame not found";
  out.pageUrlAfter = page.url();
  out.pageCookiesAfter = await page.evaluate(() => document.cookie);
  out.pageLocalStorageAfter = await page.evaluate(() => JSON.stringify({ frame_ls: localStorage.getItem("frame_ls") }));
  out.pageSwRegistrations = `${swBefore} before, ${await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)} after`;
  out.otherSlotsAfterSpoof = await page.locator("aside.ad-slot").evaluateAll((els) => els.map((e) => `${e.getAttribute("data-ad-unit")}:${e.getAttribute("data-ad-state")}`));
  // Popup opened by a click on the creative (a test click on a stub, not a real ad).
  if (frame && typeof out.inFrame === "object") {
    const [popup] = await Promise.all([ctx.waitForEvent("page", { timeout: 5000 }).catch(() => null), frame.click("#pop").catch(() => null)]);
    if (popup) {
      await popup.waitForLoadState().catch(() => {});
      out.popupOpener = await popup.evaluate(() => (window.opener === null ? "null (severed)" : "present")).catch((e) => "n/a " + e.message);
      out.popupNavigateSite = await popup.evaluate(() => { try { window.opener.top.location = "https://example.org/via-popup"; return "attempted"; } catch (e) { return "BLOCKED (" + e.name + ")"; } }).catch((e) => "n/a");
      await page.waitForTimeout(800);
      out.pageUrlAfterPopup = page.url();
      await popup.close();
    } else out.popupOpener = "no popup";
  }
  await page.close();
}

// 2. Legitimate creative still renders.
{
  const page = await ctx.newPage();
  await page.route(UNIT, (r) => r.fulfill({ contentType: "application/javascript", body: legit }));
  await page.goto(SITE + "/instagram-downloader/");
  const slot = page.locator('aside[data-ad-unit="banner728x90"]');
  await slot.scrollIntoViewIfNeeded();
  await page.waitForTimeout(3500);
  out.legitimateCreative = await slot.getAttribute("data-ad-state").catch(() => "slot gone");
  await page.close();
}
console.log(JSON.stringify(out, null, 2));
await browser.close();
