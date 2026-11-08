import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { allTools } from "@/lib/registry";
import { MONETAG_DENIED_PATHS, monetagAllowed } from "@/lib/ads/monetag-policy";

describe("Monetag central policy", () => {
  it("denies the homepage, every downloader and the downloader category; allows utility tools", () => {
    expect(monetagAllowed({ kind: "home" })).toBe(false);
    for (const t of allTools.filter((t) => t.category === "social")) {
      expect(monetagAllowed({ kind: "tool", tool: t }), t.slug).toBe(false);
      expect(MONETAG_DENIED_PATHS, t.slug).toContain(`/${t.slug}/`);
    }
    expect(monetagAllowed({ kind: "category", id: "social" })).toBe(false);
    const util = allTools.find((t) => t.slug === "pdf-merger")!;
    expect(monetagAllowed({ kind: "tool", tool: util })).toBe(true);
    expect(MONETAG_DENIED_PATHS).toContain("/");
  });

  // Build-wide check over the exported site (skipped if there is no build).
  const out = join(__dirname, "../../out");
  const html: string[] = [];
  const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (f.endsWith(".html")) html.push(p); } };
  try { walk(out); } catch { /* no build */ }
  it.skipIf(html.length === 0)("no built page with the URL box or results area contains a Monetag loader", () => {
    const hasDownloader = (s: string) => /<div[^>]*\sdata-ytx-media-input=/.test(s); // the rendered attribute, not the guard's selector text
    const offenders = html.filter((p) => { const s = readFileSync(p, "utf8"); return hasDownloader(s) && /monetag-12218(952|944)/.test(s); });
    expect(offenders).toEqual([]);
    expect(html.filter((p) => hasDownloader(readFileSync(p, "utf8"))).length).toBeGreaterThanOrEqual(8); // the check really saw the downloader pages
  });
});
