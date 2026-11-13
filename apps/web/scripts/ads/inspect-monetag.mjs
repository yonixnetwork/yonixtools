// Static review of the two Monetag loader scripts (CI only). Downloads the JavaScript
// as text and never executes it: no ad is requested or rendered, nothing is clicked.
// Reports size, hash, every hostname the code mentions, and which risky browser APIs
// it references, then follows script URLs it names (one level, max 6).
import { createHash } from "node:crypto";

const UA = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";
const LOADERS = [
  ["vignette 12218952", "https://n6wxm.com/vignette.min.js"],
  ["in-page push 12218944", "https://nap5k.com/tag.min.js"],
];
const APIS = {
  eval: /\beval\s*\(/, "new Function": /new\s+Function\s*\(|\bFunction\s*\(\s*["'`]/, "document.write": /document\.write/,
  serviceWorker: /serviceWorker/, Notification: /\bNotification\b/, "window.open": /window\.open|\bopen\s*\(/,
  "top/parent location": /(top|parent)\.location/, "location assign": /location\.(href|assign|replace)/,
  "click listener": /addEventListener\(\s*["'`](click|mousedown|pointerdown|touchstart|touchend)/, fetch: /\bfetch\s*\(/,
  XMLHttpRequest: /XMLHttpRequest/, sendBeacon: /sendBeacon/, "prototype patching": /\.prototype\.[A-Za-z]+\s*=/,
  iframe: /iframe/i, srcdoc: /srcdoc/, "blob:/data: URLs": /createObjectURL|["'`]data:text\/html/, atob: /\batob\s*\(/,
  "localStorage/cookie": /localStorage|document\.cookie/, WebSocket: /WebSocket/, "dynamic script": /createElement\(\s*["'`]script/,
};
const HOST = /\b(?:https?:)?\/\/((?:[a-z0-9-]+\.)+[a-z]{2,})(?::\d+)?/gi;
const BAREHOST = /["'`]((?:[a-z0-9-]+\.)+(?:com|net|org|io|xyz|top|info|biz|co|me|pro|site|online|click|link|space|live|cc|tv|in|ru))["'`]/gi;

async function inspect(label, url, depth) {
  let r;
  try {
    r = await fetch(url, { headers: { "user-agent": UA, referer: "https://yonixtools.com/", accept: "*/*" }, redirect: "follow" });
  } catch (e) {
    console.log(`\n### ${label}\nGET ${url} -> FAILED ${e.message}`);
    return [];
  }
  const body = await r.text();
  console.log(`\n### ${label}\nGET ${url} -> ${r.status} ${r.headers.get("content-type")} ${body.length} bytes sha256=${createHash("sha256").update(body).digest("hex").slice(0, 16)}`);
  if (r.url !== url) console.log(`redirected to ${r.url}`);
  const hosts = new Set([...body.matchAll(HOST)].map((m) => m[1].toLowerCase()));
  for (const m of body.matchAll(BAREHOST)) hosts.add(m[1].toLowerCase());
  console.log("hostnames mentioned: " + ([...hosts].sort().join(", ") || "none (built at runtime)"));
  console.log("APIs referenced: " + (Object.entries(APIS).filter(([, re]) => re.test(body)).map(([k]) => k).join(", ") || "none"));
  console.log("head: " + body.slice(0, 240).replace(/\s+/g, " "));
  const next = [...body.matchAll(/["'`]((?:https?:)?\/\/(?:[a-z0-9-]+\.)+[a-z]{2,}\/[^"'`\s]*?\.js[^"'`\s]*)["'`]/gi)].map((m) => (m[1].startsWith("//") ? "https:" + m[1] : m[1]));
  return depth === 0 ? [...new Set(next)].slice(0, 6) : [];
}

for (const [label, url] of LOADERS) {
  const next = await inspect(label, url, 0);
  for (const u of next) await inspect(`  referenced by ${label}`, u, 1);
}
