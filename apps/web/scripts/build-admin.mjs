// Generates public/admin/ads/index.html: the ADMIN-ONLY advertising test page.
// It is a standalone document (no site bundle), served under /admin/, which nginx
// protects with a password (deploy/nginx/web.conf). Nothing here is linked from the
// public site, and its code and diagnostics are not part of any public bundle.
//
// For each format it loads the unit from the separate ad origin in a test frame and
// shows what really happened: AD RENDERED only when a visible creative exists (the
// ad-origin document's strict check), otherwise EMPTY with the reason.
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
<p class="m">Each format loads from the ad origin in its own test frame. <b>AD RENDERED</b> means a visible creative exists; an existing frame or a loaded script alone never counts. Monetag is watched for up to 90 seconds. Don't click the ads.</p>
<p>Ad origin: <code id="origin"></code></p>
<p><button id="copy" type="button">Copy report</button> <span id="copied" class="m"></span></p>
<div id="units"></div>
<pre id="report"></pre>
<script>
(function () {
  var ORIGIN = ${JSON.stringify(AD_ORIGIN)}, SANDBOX = ${JSON.stringify(SANDBOX)}, UNITS = ${JSON.stringify(UNITS)};
  document.getElementById("origin").textContent = ORIGIN || "not configured: the site shows no ads";
  var rows = {}, frames = {}, t0 = Date.now();
  function verdict(r) {
    if (!r) return ["loading…", "wait"];
    var s = r.diag ? Object.values(r.diag.scripts) : [];
    if (r.state === "filled") return ["AD RENDERED (after " + (r.firstMs || "?") + " ms)", "ok"];
    if (r.state === "loading") return ["loading…", "wait"];
    if (s.length && s.every(function (x) { return x.state === "failed"; })) return ["EMPTY: ad script blocked or unreachable (ad blocker, network)", "bad"];
    if (r.diag && r.diag.errors.length) return ["EMPTY: script ran but threw errors (integration problem)", "bad"];
    if (s.some(function (x) { return x.state === "loaded"; })) return ["EMPTY: script ran without errors, no creative returned (no fill / not approved)", "bad"];
    return ["EMPTY: no script activity", "bad"];
  }
  function render() {
    var lines = ["YoniXTools admin ad test " + new Date().toISOString(), "Browser: " + navigator.userAgent, "Ad origin: " + (ORIGIN || "none"), ""];
    UNITS.forEach(function (u) {
      var r = rows[u[0]], v = verdict(r), el = document.getElementById("st-" + u[0]);
      if (el) { el.textContent = v[0]; el.className = "st " + v[1]; }
      lines.push(u[1] + ": " + v[0]);
      if (r && r.diag) {
        var d = r.diag;
        lines.push("  scripts: " + (Object.keys(d.scripts).map(function (k) { return k.replace(/^https?:\\/\\//, "") + " " + d.scripts[k].state + " @" + d.scripts[k].ms + "ms"; }).join("; ") || "none"));
        lines.push("  frame: origin=" + d.access.origin + " cookies=" + d.access.cookies + " storage=" + d.access.storage + " top=" + d.access.top);
        lines.push("  errors: " + (d.errors.join(" | ") || "none"));
        lines.push("  dom: " + (d.nodes.join(", ") || "empty"));
      }
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
      rows[u] = { state: old.state === "filled" ? "filled" : d.state, diag: d.diag || old.diag, firstMs: old.firstMs || (d.state === "filled" && d.diag ? d.diag.ms : undefined) };
      if (d.state === "filled" && typeof d.height === "number" && !UNITS.filter(function (x) { return x[0] === u; })[0][2]) f.height = String(Math.min(Math.max(d.height, 60), 1200));
      render();
    });
  }
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
