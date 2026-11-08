// Generates public/ad-frame.html: the isolated document each ad placement loads.
// It writes the publisher's exact snippet (from src/lib/ads/units.json) during
// parsing, then reports to its parent whether anything rendered and how tall it is.
import { readFileSync, writeFileSync } from "node:fs";

const units = JSON.parse(readFileSync(new URL("../src/lib/ads/units.json", import.meta.url), "utf8"));
const FILL_TIMEOUT_MS = 9000;
const NATIVE_CONTAINER = "container-cdabddda1b7a8e769299c93b91d77822";

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
  window.__ytxSlot = slot;
  // Exact publisher code, parsed as if it were in the page source (document.write and atOptions work as designed).
  document.write(UNITS[unit]);
})();
</script>
<script>
(function () {
  var slot = window.__ytxSlot, sent = -1, start = Date.now();
  if (slot === undefined || parent === window) return;
  function filled() {
    var n = document.body.querySelectorAll('iframe,img,a,ins,video,canvas');
    for (var i = 0; i < n.length; i++) { var r = n[i].getBoundingClientRect(); if (r.width > 20 && r.height > 20) return true; }
    var c = document.getElementById(${JSON.stringify(NATIVE_CONTAINER)});
    return !!(c && c.offsetHeight > 20);
  }
  function report() {
    var f = filled(), h = Math.ceil(document.documentElement.scrollHeight);
    if (f && h !== sent) { sent = h; parent.postMessage({ ytxAd: slot, state: "filled", height: h }, "*"); }
    else if (!f && sent === -1 && Date.now() - start > ${FILL_TIMEOUT_MS}) { sent = 0; parent.postMessage({ ytxAd: slot, state: "empty" }, "*"); }
  }
  setInterval(report, 700);
  window.addEventListener("load", report);
})();
</script>
</body></html>
`;
writeFileSync(new URL("../public/ad-frame.html", import.meta.url), html);
console.log("public/ad-frame.html written");
