import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import policy from "@/lib/ads/ads-policy.json";
import { countryDecision, providerStatus, resolveOverride, validatePolicy } from "@/lib/ads/policy-core.mjs";

const web = join(__dirname, "../..");
const ADSTERRA_KEYS = ["620b3190e30ed523091b51770aea0b40", "087c1ea1a028c67071c19090b33ca01b", "184daaa0dde35a067c7494257f37cd70", "cdabddda1b7a8e769299c93b91d77822"];
const MONETAG_MARKERS = ["nap5k", "n6wxm", "12218944", "12218952"];
const clone = () => JSON.parse(JSON.stringify(policy));
const verified = () => {
  const p = clone();
  Object.assign(p.provider.verification, { status: "VERIFIED", confirmedDate: "2026-11-20", evidenceRef: "TEST-ONLY", confirmedBlockedCategories: [...p.requiredBlockedCategories] });
  return p;
};

describe("advertising policy file", () => {
  it("the site's copy is identical to config/ads-policy.json (scripts/sync-ads-policy.sh)", () => {
    expect(readFileSync(join(web, "src/lib/ads/ads-policy.json"), "utf8")).toBe(readFileSync(join(web, "../../config/ads-policy.json"), "utf8"));
  });

  it("is valid, UNVERIFIED, and therefore suppresses every Adsterra unit", () => {
    expect(validatePolicy(policy)).toEqual([]);
    expect(policy.provider.name).toBe("Adsterra");
    expect(policy.provider.units.sort()).toEqual(["banner300x250", "banner320x50", "banner728x90", "native"]);
    expect(policy.provider.verification.status).toBe("UNVERIFIED");
    expect(providerStatus(policy)).toEqual({ ok: false, reason: "provider_unverified" });
    expect(countryDecision(policy, "US")).toEqual({ eligible: false, reason: "provider_unverified" });
    expect(policy.geolocation.attribution).toBe("IP geolocation by DB-IP (https://db-ip.com), licensed under CC BY 4.0");
    expect(new Set(policy.requiredBlockedCategories)).toEqual(new Set(policy.prohibitedCategories.map((c) => c.id)));
  });

  it("enables ads only with VERIFIED + date + evidence + every required category", () => {
    expect(providerStatus(verified()).ok).toBe(true);
    const a = verified(); a.provider.verification.evidenceRef = null;
    expect(providerStatus(a).reason).toBe("evidence_missing");
    const b = verified(); b.provider.verification.confirmedDate = null;
    expect(providerStatus(b).reason).toBe("evidence_missing");
    const c = verified(); c.provider.verification.confirmedBlockedCategories = c.provider.verification.confirmedBlockedCategories.filter((x: string) => x !== "sports_betting");
    expect(providerStatus(c)).toMatchObject({ ok: false, reason: "category_unconfirmed", detail: "sports_betting" });
    expect(providerStatus(null).reason).toBe("policy_missing");
  });

  it("rejects malformed policies (fail closed)", () => {
    const cases: ((p: ReturnType<typeof clone>) => void)[] = [
      (p) => (p.provider.verification.status = "verified"),
      (p) => (p.requiredBlockedCategories = p.requiredBlockedCategories.filter((x: string) => x !== "malware")),
      (p) => p.requiredBlockedCategories.push("unknown_category"),
      (p) => (p.countryRules = [{ country: "DE", rule: "suppress", reason: "x", source: "", needsLegalVerification: true, reviewed: "2026-11-20" }]),
      (p) => (p.countryRules = [{ country: "Germany", rule: "suppress", reason: "x", source: "s", needsLegalVerification: true, reviewed: "2026-11-20" }]),
      (p) => (p.countryRules = [{ country: "DE", rule: "block", reason: "x", source: "s", needsLegalVerification: true, reviewed: "2026-11-20" }]),
      (p) => (p.geolocation.failClosed = false),
      (p) => (p.permittedCategories = ["phishing"]),
      (p) => (p.lastReviewed = "14 Nov 2026"),
    ];
    for (const mutate of cases) {
      const p = verified();
      mutate(p);
      expect(validatePolicy(p).length, mutate.toString()).toBeGreaterThan(0);
      expect(providerStatus(p).reason, mutate.toString()).toBe("policy_invalid");
    }
  });

  it("country rules suppress per country; unknown country never shows ads", () => {
    const p = verified();
    p.countryRules = [{ country: "ZZ", rule: "suppress", reason: "test", source: "test fixture", needsLegalVerification: true, reviewed: "2026-11-20" }];
    expect(countryDecision(p, "ZZ")).toEqual({ eligible: false, reason: "country_suppressed" });
    expect(countryDecision(p, "US")).toEqual({ eligible: true, reason: "eligible" });
    expect(countryDecision(p, null).reason).toBe("country_unknown");
    expect(countryDecision(p, "us").reason).toBe("country_unknown");
  });

  it("the shipped country rules invent no law: each cites a source and states needsLegalVerification", () => {
    for (const r of policy.countryRules as { source: string; needsLegalVerification: unknown }[]) {
      expect(r.source.length).toBeGreaterThan(0);
      expect(typeof r.needsLegalVerification).toBe("boolean");
    }
  });
});

describe("test-only policy override", () => {
  it("is refused for production and non-local ad origins", () => {
    const o = "test-verified";
    expect(resolveOverride({ override: "" })).toBe(false);
    expect(resolveOverride({ override: o, adOrigin: "http://localhost:4175" })).toBe(true);
    expect(() => resolveOverride({ override: o, siteUrl: "https://yonixtools.com", adOrigin: "http://localhost:4175" })).toThrow(/production/);
    expect(() => resolveOverride({ override: o, siteUrl: "https://yonixtools.com/", adOrigin: "http://localhost:4175" })).toThrow(/production/);
    expect(() => resolveOverride({ override: o, adOrigin: "https://ads.yonixtools.com" })).toThrow(/local/);
    expect(() => resolveOverride({ override: o, adOrigin: "" })).toThrow(/local/);
    expect(() => resolveOverride({ override: "verified", adOrigin: "http://localhost:4175" })).toThrow(/unknown value/);
  });

  it("deploy scripts clear it", () => {
    const pd = readFileSync(join(web, "../../deploy/scripts/production-deploy.sh"), "utf8");
    expect(pd).toMatch(/env -u MONETAG[^\n]*-u NEXT_PUBLIC_ADS_POLICY_OVERRIDE/);
    expect(readFileSync(join(web, "../../deploy/scripts/deploy.sh"), "utf8")).toMatch(/unset NEXT_PUBLIC_ADS_POLICY_OVERRIDE/);
    expect(readFileSync(join(web, "Dockerfile"), "utf8")).not.toContain("NEXT_PUBLIC_ADS_POLICY_OVERRIDE");
  });
});

describe("site build with the real (unverified) policy", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
  const prod = () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://yonixtools.com");
    vi.stubEnv("NEXT_PUBLIC_AD_ORIGIN", "https://ads.yonixtools.com");
    vi.stubEnv("NEXT_PUBLIC_DOWNLOADER_API_URL", "/api");
    vi.stubEnv("NEXT_PUBLIC_ADS_POLICY_OVERRIDE", "");
    vi.stubEnv("NEXT_PUBLIC_MONETAG", "on"); // even if someone switches Monetag on, the policy keeps everything off
  };

  it("ADS_ENABLED and Monetag are off even with the production ad origin", async () => {
    prod();
    const c = await import("@/lib/ads/config");
    const m = await import("@/lib/ads/monetag");
    const p = await import("@/lib/ads/policy");
    expect(c.AD_ORIGIN).toBe("https://ads.yonixtools.com");
    expect(p.ADS_POLICY_OK).toBe(false);
    expect(p.ADS_POLICY_REASON).toBe("provider_unverified");
    expect(c.ADS_ENABLED).toBe(false);
    expect(m.MONETAG_ENABLED).toBe(false);
  });

  it("every placement renders nothing: no slot, no iframe, no reserved space", async () => {
    prod();
    const { AdPlacement } = await import("@/components/AdPlacement");
    const { AdSlot } = await import("@/components/AdSlot");
    const { PLACEMENTS } = await import("@/lib/ads/placements");
    for (const pl of PLACEMENTS) {
      const html = renderToString(createElement(AdPlacement, { page: pl.page, position: pl.position, monetag: { kind: "tools" } }));
      expect(html, pl.id).toBe("");
    }
    for (const unit of ["native", "banner300x250", "banner728x90", "banner320x50"] as const) expect(renderToString(createElement(AdSlot, { unit }))).toBe("");
  });

  it("with the local test override, slots render (so the isolation e2e tests still test a real slot)", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_AD_ORIGIN", "http://localhost:4175");
    vi.stubEnv("NEXT_PUBLIC_ADS_POLICY_OVERRIDE", "test-verified");
    const { AdSlot } = await import("@/components/AdSlot");
    const html = renderToString(createElement(AdSlot, { unit: "banner300x250" }));
    expect(html).toContain("ad-slot");
    expect(html).not.toContain("<iframe"); // never before the page view's eligibility answer
    expect((await import("@/lib/ads/eligibility")).ELIGIBILITY_URL).toBe("/api/v1/ad-eligibility");
  });
});

describe("ad-frame build (scripts/build-ad-frame.mjs)", () => {
  const build = (env: Record<string, string>) => {
    const out = mkdtempSync(join(tmpdir(), "ytx-adframe-"));
    const r = spawnSync(process.execPath, ["scripts/build-ad-frame.mjs"], { cwd: web, env: { PATH: process.env.PATH ?? "", AD_FRAME_OUT_DIR: out, ...env, NODE_ENV: "test" }, encoding: "utf8" });
    return { ...r, out, frame: existsSync(join(out, "ad-frame.html")) ? readFileSync(join(out, "ad-frame.html"), "utf8") : "", test: existsSync(join(out, "ad-test.html")) ? readFileSync(join(out, "ad-test.html"), "utf8") : "" };
  };

  it("production settings: the public frame contains no Adsterra key, no Monetag marker, and tells the parent to collapse", () => {
    for (const monetag of ["off", "on"]) {
      const r = build({ NEXT_PUBLIC_SITE_URL: "https://yonixtools.com", NEXT_PUBLIC_AD_ORIGIN: "https://ads.yonixtools.com", NEXT_PUBLIC_MONETAG: monetag });
      expect(r.status, r.stderr).toBe(0);
      for (const k of [...ADSTERRA_KEYS, ...MONETAG_MARKERS, "bellnewyork", "atOptions", "document.write"]) expect(r.frame, k).not.toContain(k);
      expect(r.frame).toContain("ytx-ads-policy: suppressed (provider_unverified)");
      expect(r.frame).toContain('state: "empty"');
      expect(r.frame).toContain('reason: "policy"');
      // The admin-only (password-protected) test page keeps the codes, under a prominent banner.
      expect(r.test).toContain("620b3190e30ed523091b51770aea0b40");
      expect(r.test).toContain("Public ads suppressed by policy: provider_unverified");
    }
  });

  it("the test override is refused for a production build (the build fails)", () => {
    const a = build({ NEXT_PUBLIC_SITE_URL: "https://yonixtools.com", NEXT_PUBLIC_AD_ORIGIN: "http://localhost:4175", NEXT_PUBLIC_ADS_POLICY_OVERRIDE: "test-verified" });
    expect(a.status).not.toBe(0);
    expect(a.frame).toBe("");
    const b = build({ NEXT_PUBLIC_AD_ORIGIN: "https://ads.yonixtools.com", NEXT_PUBLIC_ADS_POLICY_OVERRIDE: "test-verified" });
    expect(b.status).not.toBe(0);
    const admin = spawnSync(process.execPath, ["scripts/build-admin.mjs"], { cwd: web, env: { PATH: process.env.PATH ?? "", NEXT_PUBLIC_AD_ORIGIN: "https://ads.yonixtools.com", NEXT_PUBLIC_ADS_POLICY_OVERRIDE: "test-verified", NODE_ENV: "test" }, encoding: "utf8" });
    expect(admin.status).not.toBe(0);
  });

  it("the local test override builds the frame with the publisher codes (e2e only)", () => {
    const r = build({ NEXT_PUBLIC_AD_ORIGIN: "http://localhost:4175", NEXT_PUBLIC_ADS_POLICY_OVERRIDE: "test-verified" });
    expect(r.status, r.stderr).toBe(0);
    for (const k of ADSTERRA_KEYS) expect(r.frame).toContain(k);
    for (const k of MONETAG_MARKERS) expect(r.frame).not.toContain(k);
    expect(r.test).not.toContain("Public ads suppressed by policy");
  });
});

// Production-like full build (npm run build:prodlike -> out-prodlike/, run in CI). Skipped without it.
const prodOut = join(web, "out-prodlike");
const prodFiles: string[] = [];
const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else prodFiles.push(p); } };
try { walk(prodOut); } catch { /* not built */ }
describe.skipIf(prodFiles.length === 0)("production-like build (out-prodlike)", () => {
  it("no page has an ad slot or an ad frame; the ad frame has no ad code", () => {
    const pages = prodFiles.filter((p) => p.endsWith(".html") && !/\/(ad-frame|ad-test)\.html$/.test(p) && !p.includes("/admin/"));
    expect(pages.length).toBeGreaterThan(60);
    const hits = pages.filter((p) => /class="ad-slot|ad-frame\.html|<iframe[^>]*ad-frame/.test(readFileSync(p, "utf8")));
    expect(hits).toEqual([]);
    const frame = readFileSync(join(prodOut, "ad-frame.html"), "utf8");
    for (const k of [...ADSTERRA_KEYS, ...MONETAG_MARKERS]) expect(frame, k).not.toContain(k);
    expect(frame).toContain("ytx-ads-policy: suppressed");
  });
  it("no public JavaScript contains an Adsterra key or Monetag marker", () => {
    const js = prodFiles.filter((p) => p.endsWith(".js") && !p.includes("/admin/"));
    const hits = js.filter((p) => { const s = readFileSync(p, "utf8"); return [...ADSTERRA_KEYS, ...MONETAG_MARKERS].some((k) => s.includes(k)); });
    expect(hits).toEqual([]);
  });
});
