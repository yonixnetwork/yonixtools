import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { allTools } from "@/lib/registry";

describe("Monetag central policy", () => {
  it("denies the homepage, every downloader and the downloader category; allows utility tools", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_AD_ORIGIN", "https://ads.yonixtools.com");
    vi.stubEnv("NEXT_PUBLIC_MONETAG", "on");
    const { MONETAG_DENIED_PATHS, monetagAllowed } = await import("@/lib/ads/monetag-policy");
    expect(monetagAllowed({ kind: "home" })).toBe(false);
    for (const t of allTools.filter((t) => t.category === "social")) {
      expect(monetagAllowed({ kind: "tool", tool: t }), t.slug).toBe(false);
      expect(MONETAG_DENIED_PATHS, t.slug).toContain(`/${t.slug}/`);
    }
    expect(monetagAllowed({ kind: "category", id: "social" })).toBe(false);
    const util = allTools.find((t) => t.slug === "pdf-merger")!;
    expect(monetagAllowed({ kind: "tool", tool: util })).toBe(true);
    expect(MONETAG_DENIED_PATHS).toContain("/");
    vi.unstubAllEnvs();
  });

  // Build-wide check over the exported site (skipped if there is no build).
  const out = join(__dirname, "../../out");
  const html: string[] = [];
  const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (f.endsWith(".html")) html.push(p); } };
  try { walk(out); } catch { /* no build */ }
  it.skipIf(html.length === 0)("no built page with the URL box or results area contains a Monetag slot", () => {
    const hasDownloader = (s: string) => /<div[^>]*\sdata-ytx-media-input=/.test(s); // the rendered attribute, not the guard's selector text
    const offenders = html.filter((p) => { const s = readFileSync(p, "utf8"); return hasDownloader(s) && /ad-monetagPush|data-ad-unit="monetagPush"|u=monetag/.test(s); });
    expect(offenders).toEqual([]);
    expect(html.filter((p) => hasDownloader(readFileSync(p, "utf8"))).length).toBeGreaterThanOrEqual(8); // the check really saw the downloader pages
  });
});
