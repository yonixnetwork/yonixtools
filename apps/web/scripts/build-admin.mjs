// Generates public/admin/ads/index.html: the ADMIN-ONLY advertising test page.
// It is a standalone document (no site bundle), served under /admin/, which nginx
// protects with a password (deploy/nginx/web.conf). Nothing here is linked from the
// public site, and its code and diagnostics are not part of any public bundle.
//
// For each format it loads the PUBLIC ad frame from the separate ad origin, exactly as a
// real slot does, and shows the outcome the frame reports: AD RENDERED only when a visible
// creative exists, otherwise EMPTY (no fill) or BLOCKED. The public frame carries no
// diagnostics; full diagnostics (scripts, network requests, errors, framed vs top-level)
// are on the ad origin's own password-protected /ad-test.html, linked from here.
import { mkdirSync, writeFileSync } from "node:fs";

const raw = (process.env.NEXT_PUBLIC_AD_ORIGIN || "").replace(/\/$/, "");
const AD_ORIGIN = /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(raw) || /^http:\/\/(localhost|127\.0\.0\.1|[a-z0-9-]+\.localhost)(:\d+)?$/i.test(raw) ? raw : "";
const SANDBOX = "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox";
const UNITS = [
  ["banner320x50", "Adsterra banner 320 × 50", 320, 50],
  ["banner300x250", "Adsterra banner 300 × 250", 300, 250],
  ["banner728x90", "Adsterra banner 728 × 90", 728, 90],
  ["native", "Adsterra native banner", 0, 300],
  ["monetagPush", "Monetag In-Page Push", 0, 160],
  ["monetagVignette", "Monetag Vignette (test frame only: disabled on the site)", 0, 420],
];

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>Admin · ad delivery test</title>
<style>
:root{color-scheme:light dark;--b:#d0d4dc;--m:#667}
body{margin:0;font:15px/1.45 system-ui,sans-serif;padding:16px;max-width:900px;margin:auto}
h1{font-size:1.3rem;margin:.2em 0}.m{color:var(--m)}section{border:1px solid var(--b);border-radius:10px;padding:12px;margin:14px 0;overflow:hidden}
.st{font-weight:700}.ok{color:#0a7d32}.bad{color:#b3261e}.wait{color:#946200}
.box{max-width:100%;overflow:auto;margin-top:8px;border:1px dashed var(--b)}iframe{display:block;border:0;max-width:100%}
pre{white-space:pre-wrap;font-size:12px;background:rgba(127,127,127,.12);padding:10px;border-radius:8px;max-height:320px;overflow:auto}
button{font:inherit;padding:8px 14px;border-radius:8px;border:1px solid var(--b);cursor:pointer}
</style></head><body>
<h1>Ad delivery test (admin only)</h1>
<p class="m">Each format loads the public ad frame from the ad origin, exactly like a real ad slot. <b>AD RENDERED</b> means a visible creative exists; a loaded script alone never counts. Don't click the ads.</p>
<p>Ad origin: <code id="origin"></code></p>
<p><b>Full diagnostics</b> (script loaded, network requests, blocked, script errors, and each format as a separate top-level document): <a id="adtest" target="_blank" rel="noopener">open the ad-origin test page</a>. It asks for the admin login again, because it is on the ad origin.</p>
<p><button id="copy" type="button">Copy report</button> <span id="copied" class="m"></span></p>
<div id="units"></div>

<pre id="report"></pre>
<section><b>Delivery counts on the live pages</b> <button id="stats-load" type="button">Refresh</button>
<p class="m">How ad slots on real pages ended, per placement and device, since the server last started: requested, AD RENDERED (filled), empty (no fill) and blocked (ad blocker or network). Anonymous counts only. These are <b>not</b> impressions, clicks or revenue: use the Adsterra and Monetag dashboards for those.</p>
<div id="stats" class="box" style="border:0"></div></section>
<script>
(function () {
  var ORIGIN = ${JSON.stringify(AD_ORIGIN)}, SANDBOX = ${JSON.stringify(SANDBOX)}, UNITS = ${JSON.stringify(UNITS)};
  document.getElementById("origin").textContent = ORIGIN || "not configured: the site shows no ads";
  if (ORIGIN) document.getElementById("adtest").href = ORIGIN + "/ad-test.html";
  var rows = {}, frames = {}, t0 = Date.now();
  function verdict(r) {
    if (!r || r.state === "loading") return ["loading…", "wait"];
    if (r.state === "filled") return ["AD RENDERED (after " + r.ms + " ms)", "ok"];
    if (r.reason === "blocked") return ["BLOCKED: the ad script couldn't be loaded (ad blocker, network)", "bad"];
    return ["EMPTY: no creative returned (no fill, not approved, or refused in a frame): see the ad-origin test page", "bad"];
  }
  function render() {
    var lines = ["YoniXTools admin ad test " + new Date().toISOString(), "Browser: " + navigator.userAgent, "Ad origin: " + (ORIGIN || "none"), ""];
    UNITS.forEach(function (u) {
      var r = rows[u[0]], v = verdict(r), el = document.getElementById("st-" + u[0]);
      if (el) { el.textContent = v[0]; el.className = "st " + v[1]; }
      lines.push(u[1] + ": " + v[0]);
    });
    document.getElementById("report").textContent = lines.join("\\n");
  }
  if (ORIGIN) {
    var host = document.getElementById("units");
    UNITS.forEach(function (u) {
      var sec = document.createElement("section");
      sec.innerHTML = "<div><b></b> · <span class='st wait' id='st-" + u[0] + "'>loading…</span></div><div class='box'></div>";
      sec.querySelector("b").textContent = u[1];
      var f = document.createElement("iframe");
      f.title = u[1]; f.setAttribute("sandbox", SANDBOX); f.setAttribute("referrerpolicy", "strict-origin-when-cross-origin"); f.scrolling = "no";
      f.width = u[2] ? String(u[2]) : "100%"; f.height = String(u[3]); if (!u[2]) f.style.width = "100%";
      f.src = ORIGIN + "/ad-frame.html?u=" + encodeURIComponent(u[0]) + "&s=admin-" + u[0];
      sec.querySelector(".box").appendChild(f); host.appendChild(sec); frames[u[0]] = f;
    });
    window.addEventListener("message", function (e) {
      var d = e.data;
      if (e.origin !== ORIGIN || !d || typeof d.ytxAd !== "string" || d.ytxAd.indexOf("admin-") !== 0) return;
      var u = d.ytxAd.slice(6), f = frames[u];
      if (!f || e.source !== f.contentWindow) return;
      var old = rows[u] || {};
      if (old.state === "filled" || old.state === "empty") { if (d.state === "filled" && typeof d.height === "number" && !UNITS.filter(function (x) { return x[0] === u; })[0][2]) f.height = String(Math.min(Math.max(d.height, 60), 1200)); return; }
      rows[u] = { state: d.state, reason: d.reason, ms: Date.now() - t0 };
      if (d.state === "filled" && typeof d.height === "number" && !UNITS.filter(function (x) { return x[0] === u; })[0][2]) f.height = String(Math.min(Math.max(d.height, 60), 1200));
      render();
    });
  }
  function loadStats() {
    var box = document.getElementById("stats");
    fetch("/admin/api/ad-stats", { cache: "no-store", credentials: "same-origin" }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).then(function (j) {
      var t = document.createElement("table"); t.style.cssText = "border-collapse:collapse;font-size:13px;width:100%";
      var head = ["placement", "unit", "device", "requested", "filled", "empty", "blocked"];
      t.innerHTML = "<tr>" + head.map(function (h) { return "<th style='text-align:left;padding:4px;border-bottom:1px solid var(--b)'>" + h + "</th>"; }).join("") + "</tr>";
      (j.rows || []).forEach(function (row) {
        var tr = document.createElement("tr");
        head.forEach(function (h) { var td = document.createElement("td"); td.style.padding = "4px"; td.textContent = String(row[h]); tr.appendChild(td); });
        t.appendChild(tr);
      });
      box.textContent = ""; var p = document.createElement("p"); p.className = "m"; p.textContent = "Since " + new Date(j.since * 1000).toLocaleString() + (j.rows && j.rows.length ? "" : ": nothing reported yet");
      box.appendChild(p); box.appendChild(t);
    }).catch(function (e) { box.textContent = "Counts unavailable (" + e.message + ")."; });
  }
  document.getElementById("stats-load").onclick = loadStats;
  loadStats();
  render();
  setInterval(render, 2000);
  document.getElementById("copy").onclick = function () {
    navigator.clipboard.writeText(document.getElementById("report").textContent).then(function () { document.getElementById("copied").textContent = "Copied"; });
  };
})();
</script>
</body></html>
`;
mkdirSync(new URL("../public/admin/ads/", import.meta.url), { recursive: true });
writeFileSync(new URL("../public/admin/ads/index.html", import.meta.url), html);
console.log("public/admin/ads/index.html written (ad origin: " + (AD_ORIGIN || "none") + ")");
