// Adsterra behaviour probe (CI only). Loads the EXACT publisher snippets in real
// Chromium on a page served as https://yonixtools.com (Playwright route), so
// the ad server sees the real publisher domain. Reports what each loading
// strategy actually does: frames created, hosts contacted, fill, errors.
import { chromium, devices } from "@playwright/test";
import { writeFileSync } from "node:fs";

const NATIVE = `<script async="async" data-cfasync="false" src="https://bellnewyork.org/21/cdabddda1b7a8e769299c93b91d77822"></script>
<div id="container-cdabddda1b7a8e769299c93b91d77822"></div>`;
const banner = (key, w, h) => `<script>
atOptions = {
'key' : '${key}',
'format' : 'iframe',
'height' : ${h},
'width' : ${w},
'params' : {}
};
</script>
<script src="https://bellnewyork.org/22/${key}"></script>`;
const B300 = banner("620b3190e30ed523091b51770aea0b40", 300, 250);
const B728 = banner("087c1ea1a028c67071c19090b33ca01b", 728, 90);
const B320 = banner("184daaa0dde35a067c7494257f37cd70", 320, 50);

const page = (body) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="referrer" content="strict-origin-when-cross-origin"><title>probe</title></head><body style="margin:0">${body}</body></html>`;
const srcdoc = (snippet) => page(snippet).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
const frame = (snippet, w, h, sandbox) => `<iframe title="ad" width="${w}" height="${h}" style="border:0;display:block" ${sandbox === null ? "" : `sandbox="${sandbox}"`} srcdoc="${srcdoc(snippet)}"></iframe>`;
const OPAQUE = "allow-scripts allow-popups allow-popups-to-escape-sandbox";
const SAMEORIGIN = "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox";
const dynamic = (key, w, h) => `<div id="slot"></div><script>
setTimeout(() => { window.atOptions = {key:'${key}',format:'iframe',height:${h},width:${w},params:{}};
const s = document.createElement('script'); s.src = 'https://bellnewyork.org/22/${key}'; document.getElementById('slot').appendChild(s); }, 1500);</script>`;

const scenarios = [
  ["native: top-level exact", page(NATIVE), "desktop"],
  ["300x250: top-level exact", page(B300), "desktop"],
  ["728x90: top-level exact", page(B728), "desktop"],
  ["320x50: top-level exact (mobile)", page(B320), "mobile"],
  ["two banners top-level (300x250 then 728x90)", page(`<div id="a">${B300}</div><div id="b">${B728}</div>`), "desktop"],
  ["300x250: injected dynamically after load", page(dynamic("620b3190e30ed523091b51770aea0b40", 300, 250)), "desktop"],
  ["300x250: srcdoc iframe, opaque sandbox", page(frame(B300, 300, 250, OPAQUE)), "desktop"],
  ["300x250: srcdoc iframe, same-origin sandbox", page(frame(B300, 300, 250, SAMEORIGIN)), "desktop"],
  ["300x250: srcdoc iframe, no sandbox", page(frame(B300, 300, 250, null)), "desktop"],
  ["native: srcdoc iframe, opaque sandbox", page(frame(NATIVE, 360, 300, OPAQUE)), "desktop"],
  ["native: srcdoc iframe, same-origin sandbox", page(frame(NATIVE, 360, 300, SAMEORIGIN)), "desktop"],
  ["all four in separate srcdoc iframes (same-origin sandbox)", page(frame(B728, 728, 90, SAMEORIGIN) + frame(B300, 300, 250, SAMEORIGIN) + frame(B320, 320, 50, SAMEORIGIN) + frame(NATIVE, 360, 300, SAMEORIGIN)), "desktop"],
];

const browser = await chromium.launch();
const out = [];
for (const [name, html, dev] of scenarios) {
  const ctx = await browser.newContext(dev === "mobile" ? { ...devices["Pixel 7"] } : { viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  const hosts = new Map(), errors = [], popups = [];
  p.on("request", (r) => { try { const h = new URL(r.url()).host; if (h !== "yonixtools.com") hosts.set(h, (hosts.get(h) || 0) + 1); } catch {} });
  p.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 160)));
  p.on("pageerror", (e) => errors.push("pageerror: " + String(e.message).slice(0, 160)));
  p.on("popup", (pp) => popups.push(pp.url()));
  let navigatedAway = false;
  p.on("framenavigated", (f) => { if (f === p.mainFrame() && !f.url().startsWith("https://yonixtools.com/__probe")) navigatedAway = true; });
  await p.route("https://yonixtools.com/__probe", (r) => r.fulfill({ status: 200, contentType: "text/html", body: html }));
  await p.route("https://yonixtools.com/favicon.ico", (r) => r.fulfill({ status: 204 }));
  try { await p.goto("https://yonixtools.com/__probe", { waitUntil: "load", timeout: 30000 }); } catch (e) { errors.push("goto: " + e.message.slice(0, 120)); }
  await p.waitForTimeout(12000);
  const frames = p.frames().filter((f) => f !== p.mainFrame()).map((f) => ({ url: f.url().slice(0, 90), name: f.name().slice(0, 40) }));
  const dom = await p.evaluate(() => {
    const vis = (el) => { const r = el.getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}`; };
    return {
      iframes: [...document.querySelectorAll("iframe")].map((f) => `${f.src ? new URL(f.src, location.href).host : "srcdoc/about"} ${vis(f)}`),
      nativeChildren: document.getElementById("container-cdabddda1b7a8e769299c93b91d77822")?.children.length ?? null,
      bodyText: document.body.innerText.slice(0, 120),
      atOptions: typeof window.atOptions === "object" ? JSON.stringify(window.atOptions).slice(0, 120) : String(typeof window.atOptions),
      docWriteUsed: !!document.querySelector("body > iframe:not([title=ad])"),
    };
  }).catch((e) => ({ error: e.message }));
  // Inside srcdoc frames (only readable when same-origin)
  const inner = [];
  for (const f of p.frames()) {
    if (f === p.mainFrame()) continue;
    const info = await f.evaluate(() => ({ url: location.href.slice(0, 60), iframes: [...document.querySelectorAll("iframe")].map((x) => { const r = x.getBoundingClientRect(); return `${x.src ? new URL(x.src, location.href).host : "about"} ${Math.round(r.width)}x${Math.round(r.height)}`; }), native: document.getElementById("container-cdabddda1b7a8e769299c93b91d77822")?.children.length ?? null, text: document.body ? document.body.innerText.slice(0, 80) : "" })).catch((e) => ({ unreadable: e.message.slice(0, 60) }));
    inner.push(info);
  }
  const res = { name, hosts: Object.fromEntries(hosts), frames, dom, inner, errors: errors.slice(0, 8), popups, navigatedAway };
  out.push(res);
  console.log("\n### " + name + "\n" + JSON.stringify(res, null, 1));
  await ctx.close();
}
writeFileSync("ad-probe-results.json", JSON.stringify(out, null, 1));

// Static analysis of the exact scripts (as served to a normal browser with our referrer).
for (const [n, u] of [["native", "https://bellnewyork.org/21/cdabddda1b7a8e769299c93b91d77822"], ["banner300", "https://bellnewyork.org/22/620b3190e30ed523091b51770aea0b40"]]) {
  try {
    const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36", Referer: "https://yonixtools.com/" } });
    const t = await r.text();
    const has = (re) => (t.match(re) || []).length;
    console.log(`\n### SCRIPT ${n}: HTTP ${r.status}, ${t.length} bytes, content-type ${r.headers.get("content-type")}`);
    console.log(JSON.stringify({ documentWrite: has(/document\.write/g), atOptions: has(/atOptions/g), currentScript: has(/currentScript/g), getElementById: has(/getElementById/g), localStorage: has(/localStorage/g), cookie: has(/document\.cookie/g), topLocation: has(/top\.location|window\.top/g), windowOpen: has(/window\.open/g), eval: has(/\beval\(/g), postMessage: has(/postMessage/g) }));
    console.log("HEAD: " + t.slice(0, 700).replace(/\s+/g, " "));
    writeFileSync(`script-${n}.js`, t);
  } catch (e) { console.log(`SCRIPT ${n}: fetch failed ${e.message}`); }
}
await browser.close();
