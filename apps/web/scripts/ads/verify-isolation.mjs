// Reproduces the isolation check in docs/ADS_ISOLATION_PROPOSAL.md (local only, stubbed ad scripts):
//   NEXT_PUBLIC_AD_ORIGIN=http://127.0.0.1:4175 npm run build
//   PORT=4180 node scripts/serve-static.mjs out & PORT=4175 node scripts/serve-static.mjs out &
//   node scripts/ads/verify-isolation.mjs
import { chromium } from "playwright";
const hostile = `var r={};try{r.readParentDom=!!parent.document.querySelector("main")}catch(e){r.readParentDom="blocked"}
try{var s=parent.document.createElement("script");s.textContent="location.href='https://example.org/redirect'";parent.document.body.appendChild(s);r.inject="ran"}catch(e){r.inject="blocked"}
try{top.location.href="https://example.org/redirect2";r.topNav="attempted"}catch(e){r.topNav="blocked: "+e.name}
try{localStorage.setItem("x","1");r.ownStorage="ok"}catch(e){r.ownStorage="blocked"}
try{void document.cookie;r.cookies="ok"}catch(e){r.cookies="blocked"}
r.origin=self.origin;window.__r=r;`;
const legit = `document.write('<a href="https://example.com"><img width="300" height="250" src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22250%22%3E%3Crect width=%22300%22 height=%22250%22 fill=%22%23ccc%22/%3E%3C/svg%3E"></a>')`;
const b = await chromium.launch();
for (const [name, body] of [["hostile", hostile], ["legit", legit]]) {
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.route("https://bellnewyork.org/**", (r) => r.fulfill({ contentType: "application/javascript", body: "" }));
  await p.route("https://bellnewyork.org/22/620b3190e30ed523091b51770aea0b40", (r) => r.fulfill({ contentType: "application/javascript", body }));
  await p.route("https://example.org/**", (r) => r.fulfill({ contentType: "text/html", body: "REDIRECTED" }));
  await p.goto("http://localhost:4180/image-converter/");
  const ad = p.locator('aside[data-ad-unit="banner300x250"]');
  await ad.scrollIntoViewIfNeeded();
  await p.waitForTimeout(4500);
  const fr = p.frames().find((f) => f.url().includes("u=banner300x250"));
  console.log(name, JSON.stringify({ topUrl: p.url(), frameSrc: fr?.url().slice(0, 45), slotState: await ad.getAttribute("data-ad-state").catch(() => "gone"),
    sandbox: await ad.locator("iframe").getAttribute("sandbox").catch(() => null), inFrame: fr ? await fr.evaluate(() => window.__r ?? null).catch((e) => e.message) : null }));
  await p.close();
}
await b.close();
