// Generates public/ad-frame.html: the document each ad placement loads in its own iframe.
// It writes the publisher's exact snippet (from src/lib/ads/units.json) during
// parsing, then tells its parent, strictly, whether a real creative rendered:
//  - "filled" only when visible ad content exists (a sized iframe that loaded,
//    a loaded image, video/canvas, or a populated native container), seen on
//    two consecutive checks;
//  - "empty" as soon as every network script failed (ad blocker, network), or
//    when nothing rendered within the fill window.
// It also reports diagnostics (script load/error, errors, CSP violations, DOM
// inventory) that /ads-check/ shows; normal pages ignore them.
import { readFileSync, writeFileSync } from "node:fs";

const units = JSON.parse(readFileSync(new URL("../src/lib/ads/units.json", import.meta.url), "utf8"));
const FILL_TIMEOUT_MS = 8000;
const NATIVE_CONTAINER = "container-cdabddda1b7a8e769299c93b91d77822";
const SIZES = Object.fromEntries(Object.entries(units).map(([k, v]) => [k, [v.width, v.height]]));

const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<base target="_blank"><title>Advertisement</title>
<style>html,body{margin:0;padding:0;background:transparent;overflow:hidden;font-family:system-ui,sans-serif}body{text-align:center}#${NATIVE_CONTAINER}{text-align:left}</style>
</head><body>
<script>
(function () {
  var UNITS = ${JSON.stringify(Object.fromEntries(Object.entries(units).map(([k, v]) => [k, v.snippet]))).replace(/</g, "\\u003c")};
  var q = new URLSearchParams(location.search), unit = q.get("u"), slot = q.get("s") || "";
  if (!Object.prototype.hasOwnProperty.call(UNITS, unit)) return;
  // Diagnostics, recorded before the publisher code runs. Read-only: nothing here changes the ad code's behaviour.
  var d = (window.__ytxDiag = { unit: unit, start: Date.now(), scripts: {}, errors: [] });
  function note(s) { if (d.errors.length < 12) d.errors.push(String(s).slice(0, 200)); }
  function src(t) { return t && t.tagName === "SCRIPT" && t.src ? t.src : null; }
  document.addEventListener("load", function (e) { var s = src(e.target); if (s) d.scripts[s] = { state: "loaded", ms: Date.now() - d.start }; }, true);
  window.addEventListener("error", function (e) {
    var s = src(e.target);
    if (s) d.scripts[s] = { state: "failed", ms: Date.now() - d.start };
    else if (e.message) note("error: " + e.message + (e.filename ? " @ " + e.filename.split("?")[0] : ""));
  }, true);
  window.addEventListener("unhandledrejection", function (e) { note("rejection: " + (e.reason && e.reason.message || e.reason)); });
  document.addEventListener("securitypolicyviolation", function (e) { note("csp: " + e.effectiveDirective + " blocked " + (e.blockedURI || "inline")); });
  window.__ytxSlot = slot;
  // Exact publisher code, parsed as if it were in the page source (document.write and atOptions work as designed).
  document.write(UNITS[unit]);
})();
</script>
<script>
(function () {
  var slot = window.__ytxSlot, d = window.__ytxDiag;
  if (slot === undefined || !d || parent === window) return;
  var SIZE = ${JSON.stringify(SIZES)}[d.unit], native = d.unit === "native";
  var sent = "", seen = 0, done = "", loaded = typeof WeakSet === "function" ? new WeakSet() : null;
  function track(f) { if (loaded && !f.__ytx) { f.__ytx = 1; f.addEventListener("load", function () { loaded.add(f); }); } }
  function box(el) { var r = el.getBoundingClientRect(), cs = getComputedStyle(el); return cs.display !== "none" && cs.visibility !== "hidden" && +cs.opacity > 0 ? r : { width: 0, height: 0 }; }
  function frameHasContent(f) {
    try { var b = f.contentDocument && f.contentDocument.body; if (b) return b.children.length > 0 || b.textContent.trim().length > 0; } catch (e) { /* cross-origin */ }
    var s = f.getAttribute("src") || "";
    return /^https?:|^\\/\\//.test(s) && (!loaded || loaded.has(f));
  }
  function rendered() {
    var root = native ? document.getElementById(${JSON.stringify(NATIVE_CONTAINER)}) : document.body;
    if (!root) return false;
    var minW = native ? 60 : SIZE[0] * 0.5, minH = native ? 40 : SIZE[1] * 0.5;
    var fs = root.querySelectorAll("iframe");
    for (var i = 0; i < fs.length; i++) { track(fs[i]); var r = box(fs[i]); if (r.width >= minW && r.height >= minH && frameHasContent(fs[i])) return true; }
    var im = root.querySelectorAll("img,video,canvas");
    for (var j = 0; j < im.length; j++) {
      var el = im[j], r2 = box(el);
      if (r2.width < (native ? 40 : minW) || r2.height < (native ? 30 : minH)) continue;
      if (el.tagName !== "IMG" || (el.complete && el.naturalWidth > 0)) return true;
    }
    // Native widgets can be text + background images: a populated, visible container counts.
    return native && root.offsetHeight >= 40 && root.textContent.trim().length > 10;
  }
  function inventory() {
    var out = [], els = document.body.querySelectorAll("*");
    for (var i = 0; i < els.length && out.length < 10; i++) {
      var e = els[i]; if (e.tagName === "SCRIPT" || e.tagName === "STYLE") continue;
      var r = e.getBoundingClientRect(), s = e.getAttribute("src");
      out.push(e.tagName.toLowerCase() + (e.id ? "#" + e.id.slice(0, 18) : "") + " " + Math.round(r.width) + "x" + Math.round(r.height) + (s ? " " + s.replace(/^(https?:)?\\/\\//, "").split(/[/?]/)[0] : ""));
    }
    return out;
  }
  function access() {
    function t(f) { try { f(); return "ok"; } catch (e) { return "blocked"; } }
    return { origin: String(self.origin), cookies: t(function () { void document.cookie; }), storage: t(function () { void localStorage.length; }), top: t(function () { void top.location.href; }) };
  }
  function post(state) {
    var h = Math.ceil(native ? (document.getElementById(${JSON.stringify(NATIVE_CONTAINER)}) || document.body).getBoundingClientRect().bottom : document.documentElement.scrollHeight);
    var key = state + ":" + h + ":" + d.errors.length + ":" + JSON.stringify(d.scripts);
    if (key === sent) return;
    sent = key;
    parent.postMessage({ ytxAd: slot, state: state, height: h, diag: { scripts: d.scripts, errors: d.errors, nodes: inventory(), access: access(), ms: Date.now() - d.start } }, "*");
  }
  function check() {
    if (done === "empty") return;
    if (done === "filled") return post("filled"); // keep reporting height changes
    if (rendered()) { if (++seen >= 2) { done = "filled"; return post("filled"); } } else seen = 0;
    var list = [].slice.call(document.scripts).filter(function (s) { return s.src; });
    var allFailed = list.length > 0 && list.every(function (s) { return d.scripts[s.src] && d.scripts[s.src].state === "failed"; });
    if (allFailed || Date.now() - d.start > ${FILL_TIMEOUT_MS}) { done = "empty"; clearInterval(timer); return post("empty"); }
    post("loading");
  }
  var timer = setInterval(check, 500);
  window.addEventListener("load", check);
})();
</script>
</body></html>
`;
writeFileSync(new URL("../public/ad-frame.html", import.meta.url), html);
console.log("public/ad-frame.html written");
