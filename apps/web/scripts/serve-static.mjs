// Minimal static server for the exported site (local preview and e2e tests).
// Production uses Nginx; this mirrors its behaviour: /path/ → /path/index.html,
// missing files → 404.html with status 404.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(process.argv[2] || "out");
const port = Number(process.env.PORT || 4173);
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".woff2": "font/woff2", ".woff": "font/woff", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml" };

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
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  const target = resolve(root, "." + rel);
  if (!target.startsWith(root)) return res.writeHead(403).end();
  if (!rel.endsWith("/") && !extname(rel) && (await file(target)) && !(await file(target + ".html"))) {
    return res.writeHead(308, { location: url.pathname + "/" + url.search }).end();
  }
  const found = (await file(target)) || (await file(target + ".html"));
  const p = found || join(root, "404.html");
  res.writeHead(found ? 200 : 404, { "content-type": types[extname(p)] || "application/octet-stream", "cache-control": p.includes("/_next/static/") ? "public, max-age=31536000, immutable" : "no-cache" });
  res.end(await readFile(p));
}).listen(port, () => console.log(`Serving ${root} on http://localhost:${port}`));
