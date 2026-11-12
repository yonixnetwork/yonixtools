// Generates the two documents served ONLY from the separate ad origin (e.g. https://ads.yonixtools.com):
//
//  public/ad-frame.html  PUBLIC. What every ad slot loads in its iframe. Writes the publisher's exact
//                        snippet, then tells its parent strictly whether a real creative rendered
//                        ({state, height, reason}). NO diagnostics of any kind, whatever the URL or
//                        query, and it does nothing when opened outside a frame.
//  public/ad-test.html   ADMIN ONLY. Password-protected by the web server (deploy/nginx/web.conf,
//                        server-side HTTP auth; never JavaScript-only). Runs each format framed and as
//                        a separate top-level document on the ad origin, with full diagnostics:
//                        script loaded / network requests / creative rendered / no creative /
//                        blocked / script failed.
//
// Both use the same exact publisher snippets (src/lib/ads/units.json, monetag.json) and the same strict
// "rendered" check: a loaded image, a sized iframe that loaded or has content, video/canvas, a populated
// native container, or visible content added by the Monetag zone, seen on two consecutive checks. A
// script that merely loaded is never counted as an ad.
//
// Both also install a best-effort cookie guard before the publisher code runs: cookies the ad code
// sets lose any Domain attribute (so they stay on the ad host instead of being set for the whole
// yonixtools.com domain). Not a guarantee: see docs/RELEASE_ADS_ADMIN_PWA.md section 11.
import { readFileSync, writeFileSync } from "node:fs";

const adsterra = JSON.parse(readFileSync(new URL("../src/lib/ads/units.json", import.meta.url), "utf8"));
const monetag = JSON.parse(readFileSync(new URL("../src/lib/ads/monetag.json", import.meta.url), "utf8"));
const units = {
  ...adsterra,
  monetagPush: { snippet: monetag.inPagePush.snippet, width: 728, height: 120 },
  monetagVignette: { snippet: monetag.vignette.snippet, width: 0, height: 0 },
};
const NATIVE_CONTAINER = "container-cdabddda1b7a8e769299c93b91d77822";
const SIZES = Object.fromEntries(Object.entries(units).map(([k, v]) => [k, [v.width, v.height]]));
const SNIPPETS = JSON.stringify(Object.fromEntries(Object.entries(units).map(([k, v]) => [k, v.snippet]))).replace(/</g, "\\u003c");

// Runs first in both documents. Strips Domain= from cookies set via document.cookie and the Cookie
// Store API, in this document and in same-origin child frames the ad code creates.
const COOKIE_GUARD = `(function () {
  function guard(w) {
    try {
      if (!w || w.__ytxCookieGuard) return;
      w.__ytxCookieGuard = 1;
      var D = w.Document.prototype, c = Object.getOwnPropertyDescriptor(D, "cookie");
      if (c && c.set && c.configurable) Object.defineProperty(D, "cookie", { configurable: false, enumerable: c.enumerable, get: c.get, set: function (v) { return c.set.call(this, String(v).replace(/;\\s*domain\\s*=[^;]*/gi, "")); } });
      var CS = w.CookieStore && w.CookieStore.prototype, s = CS && CS.set;
      if (s) Object.defineProperty(CS, "set", { configurable: false, writable: false, value: function (a, b) { if (a && typeof a === "object") { a = Object.assign({}, a); delete a.domain; } return s.call(this, a, b); } });
      var F = w.HTMLIFrameElement.prototype;
      ["contentWindow", "contentDocument"].forEach(function (k) {
        var g = Object.getOwnPropertyDescriptor(F, k);
        if (g && g.get && g.configurable) Object.defineProperty(F, k, { configurable: false, enumerable: g.enumerable, get: function () { var cw = g.get.call(this); try { guard(k === "contentWindow" ? cw : cw && cw.defaultView); } catch (e) {} return cw; } });
      });
    } catch (e) { /* never break the ad code */ }
  }
  guard(window);
})();`;

// Runs the publisher snippet. Records script load/failure (needed for "blocked") and, in the
// test document only, errors, CSP violations and the network requests.
const runner = (diag) => `(function () {
  var UNITS = ${SNIPPETS};
  var q = new URLSearchParams(location.search), unit = q.get("u"), slot = q.get("s") || "";
  if (!Object.prototype.hasOwnProperty.call(UNITS, unit)) return;
  var d = (window.__ytx = { unit: unit, slot: slot, start: Date.now(), scripts: {}${diag ? ", errors: [], blocked: []" : ""} });
  function src(t) { return t && t.tagName === "SCRIPT" && t.src ? t.src : null; }
  document.addEventListener("load", function (e) { var s = src(e.target); if (s) d.scripts[s] = { state: "loaded", ms: Date.now() - d.start }; }, true);
  window.addEventListener("error", function (e) {
    var s = src(e.target);
    if (s) d.scripts[s] = { state: "failed", ms: Date.now() - d.start };${diag ? `
    else if (e.message && d.errors.length < 12) d.errors.push(String("error: " + e.message + (e.filename ? " @ " + e.filename.split("?")[0] : "")).slice(0, 200));` : ""}
  }, true);${diag ? `
  window.addEventListener("unhandledrejection", function (e) { if (d.errors.length < 12) d.errors.push(String("rejection: " + (e.reason && e.reason.message || e.reason)).slice(0, 200)); });
  document.addEventListener("securitypolicyviolation", function (e) { if (d.blocked.length < 12) d.blocked.push("csp " + e.effectiveDirective + ": " + (e.blockedURI || "inline")); });` : ""}
  document.write(UNITS[unit]); // exact publisher code, parsed as if it were in the page source
})();`;

// Strict creative detection, shared. Exposes window.__ytxCheck() -> {rendered, height}.
const detect = (ui) => `(function () {
  var d = window.__ytx; if (!d) return;
  var SIZE = ${JSON.stringify(SIZES)}[d.unit], native = d.unit === "native", mt = d.unit.indexOf("monetag") === 0;
  var SKIP = { HTML: 1, HEAD: 1, BODY: 1, SCRIPT: 1, STYLE: 1, META: 1, LINK: 1, TITLE: 1, BASE: 1, NOSCRIPT: 1 };
  var loaded = typeof WeakSet === "function" ? new WeakSet() : null, mBottom = 0;
  function track(f) { if (loaded && !f.__ytx) { f.__ytx = 1; f.addEventListener("load", function () { loaded.add(f); }); } }
  function box(el) { var r = el.getBoundingClientRect(), cs = getComputedStyle(el); return cs.display !== "none" && cs.visibility !== "hidden" && +cs.opacity > 0 ? r : { width: 0, height: 0, bottom: 0 }; }
  function frameHasContent(f) {
    try { var b = f.contentDocument && f.contentDocument.body; if (b) return b.children.length > 0 || b.textContent.trim().length > 0; } catch (e) { /* cross-origin */ }
    var s = f.getAttribute("src") || "";
    return /^https?:|^\\/\\//.test(s) && (!loaded || loaded.has(f));
  }
  function monetag() { // anything visible the zone added (its own elements or frames), not just its script
    var all = document.querySelectorAll("*"), ok = false; mBottom = 0;
    for (var i = 0; i < all.length; i++) {
      var el = all[i]; if (SKIP[el.tagName]${ui ? ' || (el.closest && el.closest("[data-ytx-ui]"))' : ''}) continue;
      var r = box(el); if (r.width * r.height < 3000) continue;
      if (el.tagName === "IFRAME") { track(el); if (!frameHasContent(el)) continue; }
      if (el.tagName === "IMG" && !(el.complete && el.naturalWidth > 0)) continue;
      if (el.tagName !== "IFRAME" && el.tagName !== "IMG" && !el.querySelector("img,iframe,video,canvas") && el.textContent.trim().length < 10 && getComputedStyle(el).backgroundImage === "none") continue;
      ok = true; mBottom = Math.max(mBottom, r.bottom);
    }
    return ok;
  }
  function adsterra() {
    var root = native ? document.getElementById(${JSON.stringify(NATIVE_CONTAINER)}) : document.body;
    if (!root) return false;
    var minW = native ? 60 : SIZE[0] * 0.5, minH = native ? 40 : SIZE[1] * 0.5;
    var fs = root.querySelectorAll("iframe");
    for (var i = 0; i < fs.length; i++) { ${ui ? 'if (fs[i].closest("[data-ytx-ui]")) continue; ' : ''}track(fs[i]); var r = box(fs[i]); if (r.width >= minW && r.height >= minH && frameHasContent(fs[i])) return true; }
    var im = root.querySelectorAll("img,video,canvas");
    for (var j = 0; j < im.length; j++) {
      var el = im[j], r2 = box(el);
      if (${ui ? 'el.closest("[data-ytx-ui]") || ' : ''}r2.width < (native ? 40 : minW) || r2.height < (native ? 30 : minH)) continue;
      if (el.tagName !== "IMG" || (el.complete && el.naturalWidth > 0)) return true;
    }
    return native && root.offsetHeight >= 40 && root.textContent.trim().length > 10; // text + background-image tiles
  }
  window.__ytxCheck = function () {
    var ok = mt ? monetag() : adsterra();
    var h = native ? (document.getElementById(${JSON.stringify(NATIVE_CONTAINER)}) || document.body).getBoundingClientRect().bottom : mt ? Math.min(Math.max(mBottom, 60), 600) : document.documentElement.scrollHeight;
    return { rendered: ok, height: Math.ceil(h) };
  };
  window.__ytxAllFailed = function () {
    var list = [].slice.call(document.scripts).filter(function (s) { return s.src; });
    return list.length > 0 && list.every(function (s) { return d.scripts[s.src] && d.scripts[s.src].state === "failed"; });
  };
})();`;

const head = (title, extra = "") => `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow">
<meta name="monetag" content="d69414fd01256df4752b5cfc142c85c0">
<base target="_blank"><title>${title}</title>
<style>html,body{margin:0;padding:0;background:transparent;overflow:hidden;font-family:system-ui,sans-serif}body{text-align:center}#${NATIVE_CONTAINER}{text-align:left}${extra}</style>
</head><body>`;

// ── PUBLIC frame ─────────────────────────────────────────────────────────────────────────────
const FILL_TIMEOUT_MS = 8000;
const MONETAG_TIMEOUT_MS = 14000; // In-Page Push can appear after a short delay
const frame = `${head("Advertisement")}
<script>
${COOKIE_GUARD}
</script>
<script>
${runner(false)}
</script>
<script>
${detect(false)}
</script>
<script>
(function () {
  var d = window.__ytx;
  if (!d || parent === window || !window.__ytxCheck) return; // only inside a frame; nothing when opened directly
  var mt = d.unit.indexOf("monetag") === 0, seen = 0, done = "", sent = "", reason = "";
  function post(state) {
    var c = window.__ytxCheck(), key = state + ":" + c.height;
    if (key === sent) return;
    sent = key;
    var msg = { ytxAd: d.slot, state: state, height: c.height };
    if (state === "empty") msg.reason = reason; // "blocked" (scripts unreachable) or "nofill"
    parent.postMessage(msg, "*");
  }
  function check() {
    if (done === "empty") return;
    if (done === "filled") return post("filled"); // keep reporting height changes
    if (window.__ytxCheck().rendered) { if (++seen >= 2) { done = "filled"; return post("filled"); } } else seen = 0;
    var allFailed = window.__ytxAllFailed();
    if (allFailed || Date.now() - d.start > (mt ? ${MONETAG_TIMEOUT_MS} : ${FILL_TIMEOUT_MS})) { done = "empty"; reason = allFailed ? "blocked" : "nofill"; clearInterval(timer); return post("empty"); }
    post("loading");
  }
  var timer = setInterval(check, 500);
  window.addEventListener("load", check);
})();
</script>
</body></html>
`;

// ── ADMIN test document ──────────────────────────────────────────────────────────────────────
const TEST_TIMEOUT_MS = { adsterra: 20000, monetag: 90000 };
const SANDBOX = "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox";
const LABELS = [
  ["banner320x50", "Adsterra banner 320 × 50"], ["banner300x250", "Adsterra banner 300 × 250"], ["banner728x90", "Adsterra banner 728 × 90"],
  ["native", "Adsterra native banner"], ["monetagPush", "Monetag In-Page Push (zone 12218944)"], ["monetagVignette", "Monetag Vignette (zone 12218952): test only, disabled on the site"],
];
const test = `${head("Admin · ad test (ad origin)", "[data-ytx-ui]{font:13px/1.45 system-ui,sans-serif;text-align:left;color:#111;background:#fff}")}
<script>
${COOKIE_GUARD}
</script>
<script>
${runner(true)}
</script>
<script>
${detect(true)}
</script>
<script>
(function () {
  var LABELS = ${JSON.stringify(LABELS)}, SIZES = ${JSON.stringify(SIZES)}, SANDBOX = ${JSON.stringify(SANDBOX)};
  var q = new URLSearchParams(location.search), d = window.__ytx, embed = q.get("embed") === "1";

  function requests() { // Resource Timing: what this document fetched. Cross-origin status codes are hidden unless the server allows it.
    var out = [];
    try {
      performance.getEntriesByType("resource").forEach(function (e) {
        if (out.length >= 40) return;
        var u = e.name.replace(/^https?:\\/\\//, ""), st = e.responseStatus;
        out.push({ url: u.split("?")[0].slice(0, 80) + (u.indexOf("?") > 0 ? "?…" : ""), type: e.initiatorType, ms: Math.round(e.duration), status: st > 0 ? String(st) : "completed (status not visible cross-origin)" });
      });
    } catch (e) { out.push({ url: "resource timing unavailable", type: "", ms: 0, status: "" }); }
    return out;
  }
  function snapshot(state) {
    return { unit: d.unit, state: state, ms: Date.now() - d.start, scripts: d.scripts, errors: d.errors, blocked: d.blocked, requests: requests(),
      top: (function () { try { void top.location.href; return "same origin"; } catch (e) { return "cross-origin (blocked)"; } })(), framed: parent !== window };
  }
  // The six outcomes, strictly. "Rendered" only from the creative check, never from a loaded script.
  window.__ytxVerdict = function (r) {
    var s = Object.keys(r.scripts).map(function (k) { return r.scripts[k]; });
    if (r.state === "filled") return ["CREATIVE RENDERED (after " + r.ms + " ms)", "ok"];
    if (r.blocked.length || (s.length && s.every(function (x) { return x.state === "failed"; }))) return ["REQUEST BLOCKED: the ad script could not be loaded (ad blocker, CSP, network, DNS or HTTP error)", "bad"];
    if (r.errors.length) return [(r.state === "loading" ? "watching… " : "") + "SCRIPT FAILED: the ad script loaded but threw errors", "bad"];
    if (r.state === "loading") return ["watching… (" + Math.round(r.ms / 1000) + " s)" + (s.some(function (x) { return x.state === "loaded"; }) ? ": script loaded, no creative yet" : ""), "wait"];
    if (s.some(function (x) { return x.state === "loaded"; })) return ["NO CREATIVE RETURNED: script loaded, " + r.requests.length + " network requests completed, nothing rendered (no fill, zone/site not approved, or the zone refuses this context)", "bad"];
    return ["NO SCRIPT ACTIVITY", "bad"];
  };
  window.__ytxReport = function (label, r) {
    var v = window.__ytxVerdict(r), L = [label + ": " + v[0]];
    L.push("  context: " + (r.framed ? "inside a frame (top: " + r.top + ")" : "separate top-level document on " + location.origin));
    L.push("  script loaded: " + (Object.keys(r.scripts).map(function (k) { return k.replace(/^https?:\\/\\//, "") + " " + r.scripts[k].state + " @" + r.scripts[k].ms + "ms"; }).join("; ") || "none yet"));
    L.push("  network requests: " + (r.requests.length ? "" : "none"));
    r.requests.forEach(function (x) { L.push("    " + x.url + " [" + x.type + ", " + x.ms + " ms, " + x.status + "]"); });
    L.push("  blocked: " + (r.blocked.join(" | ") || "none"));
    L.push("  script errors: " + (r.errors.join(" | ") || "none"));
    return L.join("\\n");
  };

  if (d && window.__ytxCheck) {
    // Running one unit: framed (embed=1, reports to the index page on this same origin) or top-level.
    var mt = d.unit.indexOf("monetag") === 0, seen = 0, state = "loading";
    var panel = null;
    if (!embed || parent === window) {
      document.documentElement.style.overflow = document.body.style.overflow = "auto";
      panel = document.createElement("pre"); panel.setAttribute("data-ytx-ui", "");
      panel.style.cssText = "position:fixed;left:0;right:0;bottom:0;max-height:50vh;overflow:auto;margin:0;padding:8px;white-space:pre-wrap;border-top:2px solid #888;z-index:2147483647";
      document.documentElement.appendChild(panel);
    }
    var tick = function () {
      if (state === "loading") {
        if (window.__ytxCheck().rendered) { if (++seen >= 2) state = "filled"; } else seen = 0;
        if (state === "loading" && (window.__ytxAllFailed() || Date.now() - d.start > (mt ? ${TEST_TIMEOUT_MS.monetag} : ${TEST_TIMEOUT_MS.adsterra}))) state = "empty";
      }
      var r = snapshot(state);
      if (panel) panel.textContent = "ADMIN TEST · " + window.__ytxReport(d.unit, r) + "\\n\\nDon't click the ad.";
      else parent.postMessage({ ytxTest: d.unit, report: r }, location.origin);
    };
    setInterval(tick, 1000); window.addEventListener("load", tick);
    return;
  }

  // Index: every format framed (like a real slot) plus a link to run it as a top-level document.
  document.documentElement.style.overflow = document.body.style.overflow = "auto";
  var ui = document.createElement("div"); ui.setAttribute("data-ytx-ui", ""); ui.style.cssText = "max-width:900px;margin:auto;padding:16px";
  ui.innerHTML = "<h1 style='font-size:1.3rem'>Ad test on the ad origin (admin only)</h1><p>Origin: <code></code>. Each format runs here in a frame like a real slot, and can be opened as a separate top-level document on this origin. Monetag is watched for 90 s. <b>CREATIVE RENDERED</b> only when a visible creative exists. Don't click the ads.</p><p><button type='button' id='copy'>Copy report</button> <span id='copied'></span></p><div id='units'></div><pre id='report' style='white-space:pre-wrap;background:#f2f2f2;padding:10px'></pre>";
  ui.querySelector("code").textContent = location.origin;
  document.body.appendChild(ui);
  var rows = {}, frames = {};
  LABELS.forEach(function (l) {
    var sec = document.createElement("section"); sec.style.cssText = "border:1px solid #ccc;border-radius:8px;padding:10px;margin:12px 0";
    sec.innerHTML = "<div><b></b> · <a target='_blank' rel='noopener'>open top-level</a></div><div class='st' style='font-weight:700;margin:4px 0'>watching…</div><div class='box' style='overflow:auto;border:1px dashed #ccc'></div>";
    sec.querySelector("b").textContent = l[1];
    sec.querySelector("a").href = location.pathname + "?u=" + l[0];
    var f = document.createElement("iframe"), sz = SIZES[l[0]];
    f.setAttribute("sandbox", SANDBOX); f.scrolling = "no"; f.style.cssText = "display:block;border:0;max-width:100%";
    f.width = sz[0] ? String(sz[0]) : "100%"; f.height = String(sz[1] || 300);
    f.src = location.pathname + "?u=" + l[0] + "&embed=1";
    sec.querySelector(".box").appendChild(f); document.getElementById("units").appendChild(sec);
    frames[l[0]] = { f: f, st: sec.querySelector(".st"), label: l[1] };
  });
  window.addEventListener("message", function (e) {
    var m = e.data; if (e.origin !== location.origin || !m || typeof m.ytxTest !== "string" || !frames[m.ytxTest] || e.source !== frames[m.ytxTest].f.contentWindow) return;
    rows[m.ytxTest] = m.report;
    var v = window.__ytxVerdict(m.report), x = frames[m.ytxTest]; x.st.textContent = v[0]; x.st.style.color = v[1] === "ok" ? "#0a7d32" : v[1] === "bad" ? "#b3261e" : "#946200";
    document.getElementById("report").textContent = ["YoniXTools ad-origin test " + new Date().toISOString(), "Browser: " + navigator.userAgent, ""].concat(LABELS.filter(function (l) { return rows[l[0]]; }).map(function (l) { return window.__ytxReport(l[1], rows[l[0]]); })).join("\\n");
  });
  document.getElementById("copy").onclick = function () { navigator.clipboard.writeText(document.getElementById("report").textContent).then(function () { document.getElementById("copied").textContent = "Copied"; }); };
})();
</script>
</body></html>
`;

writeFileSync(new URL("../public/ad-frame.html", import.meta.url), frame);
writeFileSync(new URL("../public/ad-test.html", import.meta.url), test);
console.log("public/ad-frame.html and public/ad-test.html written");
