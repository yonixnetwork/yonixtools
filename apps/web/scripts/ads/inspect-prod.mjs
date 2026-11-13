// Inspect the LIVE site's advertising in real Chromium (CI only). Read-only:
// loads pages, never clicks ads. Records slot states over time, network
// statuses for the ad network, console/page errors (including inside ad
// frames), the DOM inside each frame, and the ad frame's response headers.
import { chromium, devices } from "@playwright/test";

const BASE = process.env.SITE || "https://yonixtools.com";
const pages = ["/", "/image-compressor/", "/instagram-downloader/", "/ads-check/"];
const browser = await chromium.launch();
for (const [devName, dev] of [["desktop", { viewport: { width: 1366, height: 900 } }], ["android", devices["Pixel 7"]]]) {
  for (const path of pages) {
    const ctx = await browser.newContext({ ...dev, serviceWorkers: "block" });
    const page = await ctx.newPage();
    const net = [], errors = [];
    page.on("response", (r) => { const u = r.url(); if (!u.startsWith(BASE) || u.includes("ad-frame")) net.push(`${r.status()} ${r.request().resourceType()} ${u.slice(0, 110)}`); });
    page.on("requestfailed", (r) => net.push(`FAILED(${r.failure()?.errorText}) ${r.url().slice(0, 110)}`));
    page.on("console", (m) => ["error", "warning"].includes(m.type()) && errors.push(`${m.type()}: ${m.text().slice(0, 160)} @ ${m.location().url.slice(0, 60)}`));
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 160)}`));
    await page.goto(BASE + path, { waitUntil: "load" });
    const timeline = [];
    for (const t of [1, 4, 8, 12, 16]) {
      await page.waitForTimeout(t === 1 ? 1000 : 4000);
      // scroll through the page so lazy slots load
      await page.evaluate((frac) => window.scrollTo(0, document.body.scrollHeight * frac), Math.min(1, t / 12));
      const s = await page.$$eval("aside.ad-slot", (els) => els.map((e) => { const r = e.getBoundingClientRect(); return `${e.getAttribute("data-ad-unit") || "reserve"}:${e.getAttribute("data-ad-state") || "-"}:${Math.round(r.width)}x${Math.round(r.height)}`; }));
      timeline.push(`t≈${t}s ${s.join(" | ") || "(no slots)"}`);
    }
    const frames = [];
    for (const f of page.frames()) {
      if (f === page.mainFrame()) continue;
      const info = await f.evaluate(() => {
        const list = [...document.body.querySelectorAll("*")].filter((e) => !["SCRIPT", "STYLE"].includes(e.tagName)).slice(0, 12).map((e) => {
          const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
          return `${e.tagName}${e.id ? "#" + e.id : ""} ${Math.round(r.width)}x${Math.round(r.height)} ${cs.display}/${cs.visibility}/${cs.opacity}${e.src ? " src=" + String(e.src).slice(0, 70) : ""}`;
        });
        return { url: location.href.slice(0, 90), origin: String(self.origin), scripts: [...document.scripts].map((s) => s.src ? s.src.slice(0, 70) : "inline"), elements: list, cookieAccess: (() => { try { void document.cookie; return "ok"; } catch (e) { return "THROWS " + e.name; } })(), storage: (() => { try { void localStorage.length; return "ok"; } catch (e) { return "THROWS " + e.name; } })(), topAccess: (() => { try { void top.location.href; return "ok"; } catch (e) { return "THROWS " + e.name; } })() };
      }).catch((e) => ({ unreadable: e.message.slice(0, 80) }));
      frames.push(info);
    }
    console.log(`\n### ${devName} ${path}`);
    console.log(timeline.join("\n"));
    console.log("NETWORK:\n  " + (net.join("\n  ") || "(none)"));
    console.log("ERRORS:\n  " + (errors.slice(0, 15).join("\n  ") || "(none)"));
    console.log("FRAMES:\n  " + frames.map((f) => JSON.stringify(f)).join("\n  "));
    if (path === "/image-compressor/" && devName === "android") await page.screenshot({ path: `prod-${devName}-tool.png`, fullPage: true });
    if (path === "/" && devName === "desktop") await page.screenshot({ path: `prod-${devName}-home.png`, fullPage: true });
    await ctx.close();
  }
}
const r = await fetch(BASE + "/ad-frame.html");
console.log("\n### /ad-frame.html headers: " + r.status + "\n" + [...r.headers].map(([k, v]) => `  ${k}: ${v.slice(0, 200)}`).join("\n"));
const home = await (await fetch(BASE + "/")).text();
console.log("\n### deployed build markers: ad-frame refs=" + (home.match(/ad-slot/g) || []).length + ", sw=" + /sw\.js/.test(home));
await browser.close();
