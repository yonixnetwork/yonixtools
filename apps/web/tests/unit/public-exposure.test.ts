import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import units from "@/lib/ads/units.json";
import { AD_UNITS } from "@/lib/ads/config";

const out = join(__dirname, "../../out");
const files: string[] = [];
const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else files.push(p); } };
try { walk(out); } catch { /* no build */ }
const rel = (p: string) => relative(out, p);
// Allowed to contain ad code: the ad-origin document and the password-protected admin page.
const isAdDoc = (p: string) => rel(p) === "ad-frame.html" || rel(p).startsWith("admin/");
const publicHtml = files.filter((p) => p.endsWith(".html") && !isAdDoc(p));
const publicJs = files.filter((p) => p.endsWith(".js") && !isAdDoc(p) && !rel(p).endsWith("sw.js"));

const PUBLISHER_IDS = ["cdabddda1b7a8e769299c93b91d77822", "620b3190e30ed523091b51770aea0b40", "087c1ea1a028c67071c19090b33ca01b", "184daaa0dde35a067c7494257f37cd70", "12218944", "12218952"];
const AD_HOSTS = ["bellnewyork.org", "n6wxm.com", "nap5k.com", "5gvci.com"];
// Developer / admin / server-internal wording that must never reach visitors.
const INTERNAL_TEXT = ["ads-check", "deleted from our server", "files deleted after", "Backend coming soon", "launches with the backend", "real downloads from a cloud server", "sandboxed", "same-origin", "stack trace", "Traceback", "/var/lib/yonixtools", "/opt/yonixtools", "internal/stats"];

describe("nothing internal is public", () => {
  it.skipIf(publicHtml.length === 0)("public pages contain no publisher/zone ids, ad-network hosts or internal wording", () => {
    const hits: string[] = [];
    for (const p of publicHtml) {
      const s = readFileSync(p, "utf8");
      for (const t of [...PUBLISHER_IDS, ...AD_HOSTS, ...INTERNAL_TEXT]) if (s.includes(t)) hits.push(`${rel(p)}: ${t}`);
    }
    expect(hits).toEqual([]);
    expect(publicHtml.length).toBeGreaterThan(60);
  });

  it.skipIf(publicJs.length === 0)("public JavaScript bundles contain no publisher/zone ids or ad-network hosts", () => {
    const hits: string[] = [];
    for (const p of publicJs) {
      const s = readFileSync(p, "utf8");
      for (const t of [...PUBLISHER_IDS, ...AD_HOSTS]) if (s.includes(t)) hits.push(`${rel(p)}: ${t}`);
    }
    expect(hits).toEqual([]);
  });

  it("ad sizes used by the site match the publisher units", () => {
    for (const [id, u] of Object.entries(units)) {
      const a = AD_UNITS[id as keyof typeof AD_UNITS];
      expect(a, id).toBeDefined();
      if (!a.fluid) expect([a.width, a.height], id).toEqual([u.width, u.height]);
    }
  });
});

describe("ads need a separate ad origin", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
  const load = async (origin: string) => { vi.resetModules(); vi.stubEnv("NEXT_PUBLIC_AD_ORIGIN", origin); return import("@/lib/ads/config"); };

  it("no ad origin (or an invalid one) means no ads at all", async () => {
    for (const o of ["", "yonixtools.com", "javascript:alert(1)", "https://x.com/path", "http://ads.example.com", "https://x.com; script-src *"]) {
      const c = await load(o);
      expect(c.ADS_ENABLED, o).toBe(false);
      expect(c.AD_ORIGIN, o).toBe("");
    }
  });
  it("an https ad origin enables ads (http only for local tests)", async () => {
    expect((await load("https://ads.yonixtools.com")).ADS_ENABLED).toBe(true);
    expect((await load("http://localhost:4175")).AD_ORIGIN).toBe("http://localhost:4175");
  });
});
