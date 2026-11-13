// Minimal static server for the exported site (local preview and e2e tests).
// Production uses Nginx; this mirrors its behaviour: /path/ → /path/index.html,
// missing files → 404.html with status 404.
import { createServer, request as httpRequest } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const root = resolve(process.argv[2] || "out");
const port = Number(process.env.PORT || 4173);
// Optional: forward /api/* to the downloader (prefix stripped), like the production Nginx.
const apiProxy = process.env.API_PROXY ? new URL(process.env.API_PROXY) : null;
// Same origin rule as the production Nginx (web.conf $ytx_wrong_origin): ORIGIN_ROLE=ad serves
// only the two ad documents; ORIGIN_ROLE=site never serves them. (Unset: everything, for previews.)
const role = process.env.ORIGIN_ROLE || "";
const AD_DOC = /^\/(ad-frame|ad-test)\.html$/;
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".woff2": "font/woff2", ".woff": "font/woff", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml", ".webmanifest": "application/manifest+json" };

async function file(p) {
  try {
    const s = await stat(p);
    if (s.isDirectory()) return file(join(p, "index.html"));
    return p;
  } catch {
    return null;
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://localhost");
  if (apiProxy && url.pathname.startsWith("/api/")) {
    const headers = { ...req.headers, host: apiProxy.host };
    delete headers["x-forwarded-for"];
    const up = httpRequest({ host: apiProxy.hostname, port: apiProxy.port, method: req.method, path: url.pathname.slice(4) + url.search, headers }, (r) => {
      res.writeHead(r.statusCode || 502, r.headers);
      r.pipe(res);
    });
    up.on("error", () => res.writeHead(502).end());
    return req.pipe(up);
  }
  if ((role === "ad" && !AD_DOC.test(url.pathname)) || (role === "site" && /^\/ad-(frame|test)/.test(url.pathname))) {
    return res.writeHead(404, { "content-type": "text/plain" }).end("Not found\n");
  }
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  const target = resolve(root, "." + rel);
  if (!target.startsWith(root)) return res.writeHead(403).end();
  if (!rel.endsWith("/") && !extname(rel) && (await file(target)) && !(await file(target + ".html"))) {
    return res.writeHead(308, { location: url.pathname + "/" + url.search }).end();
  }
  const found = (await file(target)) || (await file(target + ".html"));
  const p = found || join(root, "404.html");
  const headers = { "content-type": types[extname(p)] || "application/octet-stream", "cache-control": p.includes("/_next/static/") ? "public, max-age=31536000, immutable" : "no-cache", vary: "accept-encoding" };
  let body = await readFile(p);
  // gzip text like the production Nginx does (parity for performance measurements).
  if (/gzip/.test(req.headers["accept-encoding"] || "") && /\.(html|js|css|json|svg|xml|txt)$/.test(p) && body.length > 1024) {
    body = gzipSync(body, { level: 6 });
    headers["content-encoding"] = "gzip";
  }
  res.writeHead(found ? 200 : 404, headers);
  res.end(body);
}).listen(port, () => console.log(`Serving ${root} on http://localhost:${port}`));
