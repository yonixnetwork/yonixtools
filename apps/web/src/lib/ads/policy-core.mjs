// Advertising policy logic, shared by the site (lib/ads/policy.ts) and the build scripts
// (scripts/build-ad-frame.mjs, scripts/build-admin.mjs). Plain JavaScript so Node runs it without a
// TypeScript step; types in policy-core.d.mts. The backend has the same rules in Python
// (services/downloader/app/ads_policy.py); both are tested against the same policy file.
//
// Fail closed: anything missing, malformed or unconfirmed means "no ads".

const STATUSES = ["UNVERIFIED", "VERIFIED"];
const RULES = ["suppress", "allow"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[a-z][a-z0-9_]{1,63}$/;
const COUNTRY = /^[A-Z]{2}$/;

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isDate = (v) => typeof v === "string" && DATE.test(v) && !Number.isNaN(Date.parse(v + "T00:00:00Z"));
const nonEmpty = (v) => typeof v === "string" && v.trim().length > 0;

/** Structural validation. Returns a list of problems (empty = valid). */
export function validatePolicy(p) {
  const e = [];
  if (!isObj(p)) return ["policy is not an object"];
  if (!Number.isInteger(p.version) || p.version < 1) e.push("version must be a positive integer");
  if (!isDate(p.lastReviewed)) e.push("lastReviewed must be YYYY-MM-DD");
  const pr = p.provider;
  if (!isObj(pr)) e.push("provider missing");
  else {
    if (pr.name !== "Adsterra") e.push("provider.name must be Adsterra");
    const v = pr.verification;
    if (!isObj(v)) e.push("provider.verification missing");
    else {
      if (!STATUSES.includes(v.status)) e.push("provider.verification.status must be UNVERIFIED or VERIFIED");
      if (v.confirmedDate !== null && !isDate(v.confirmedDate)) e.push("provider.verification.confirmedDate must be null or YYYY-MM-DD");
      if (v.evidenceRef !== null && !nonEmpty(v.evidenceRef)) e.push("provider.verification.evidenceRef must be null or a non-empty string");
      if (!Array.isArray(v.confirmedBlockedCategories) || !v.confirmedBlockedCategories.every((x) => typeof x === "string" && ID.test(x))) e.push("provider.verification.confirmedBlockedCategories must be a list of category ids");
    }
  }
  const ids = new Set();
  if (!Array.isArray(p.prohibitedCategories) || p.prohibitedCategories.length === 0) e.push("prohibitedCategories must be a non-empty list");
  else for (const c of p.prohibitedCategories) {
    if (!isObj(c) || typeof c.id !== "string" || !ID.test(c.id) || !nonEmpty(c.label)) { e.push("prohibitedCategories entries need an id and a label"); continue; }
    if (ids.has(c.id)) e.push(`duplicate prohibited category ${c.id}`);
    ids.add(c.id);
  }
  if (!Array.isArray(p.requiredBlockedCategories)) e.push("requiredBlockedCategories must be a list");
  else {
    for (const id of p.requiredBlockedCategories) if (!ids.has(id)) e.push(`requiredBlockedCategories: unknown category ${id}`);
    // Every prohibited category must be confirmed blocked by the provider: none can be left out.
    for (const id of ids) if (!p.requiredBlockedCategories.includes(id)) e.push(`requiredBlockedCategories must include ${id}`);
  }
  if (!Array.isArray(p.permittedCategories) || !p.permittedCategories.every((x) => typeof x === "string" && ID.test(x))) e.push("permittedCategories must be a list of category ids");
  else for (const id of p.permittedCategories) if (ids.has(id)) e.push(`category ${id} cannot be both prohibited and permitted`);
  if (!Array.isArray(p.countryRules)) e.push("countryRules must be a list");
  else {
    const seen = new Set();
    for (const r of p.countryRules) {
      if (!isObj(r) || typeof r.country !== "string" || !COUNTRY.test(r.country)) { e.push("countryRules: country must be an ISO 3166-1 alpha-2 code"); continue; }
      if (seen.has(r.country)) e.push(`countryRules: duplicate ${r.country}`);
      seen.add(r.country);
      if (!RULES.includes(r.rule)) e.push(`countryRules ${r.country}: rule must be suppress or allow`);
      if (!nonEmpty(r.reason)) e.push(`countryRules ${r.country}: reason required`);
      if (!nonEmpty(r.source)) e.push(`countryRules ${r.country}: source citation required`);
      if (typeof r.needsLegalVerification !== "boolean") e.push(`countryRules ${r.country}: needsLegalVerification must be true or false`);
      if (!isDate(r.reviewed)) e.push(`countryRules ${r.country}: reviewed must be YYYY-MM-DD`);
    }
  }
  const g = p.geolocation;
  if (!isObj(g) || g.failClosed !== true || !nonEmpty(g.provider) || !nonEmpty(g.license) || !nonEmpty(g.attribution)) e.push("geolocation needs provider, license, attribution and failClosed: true");
  if (!Array.isArray(p.sources) || p.sources.length === 0) e.push("sources must be a non-empty list");
  return e;
}

/**
 * Provider-level decision (no visitor data): may this build ship ad code at all?
 * {ok, reason}: reason is one of policy_missing, policy_invalid, provider_unverified,
 * evidence_missing, category_unconfirmed, ok.
 */
export function providerStatus(p) {
  if (p === undefined || p === null) return { ok: false, reason: "policy_missing" };
  const errors = validatePolicy(p);
  if (errors.length) return { ok: false, reason: "policy_invalid", detail: errors.join("; ") };
  const v = p.provider.verification;
  if (v.status !== "VERIFIED") return { ok: false, reason: "provider_unverified" };
  if (!v.confirmedDate || !v.evidenceRef) return { ok: false, reason: "evidence_missing" };
  const missing = p.requiredBlockedCategories.filter((id) => !v.confirmedBlockedCategories.includes(id));
  if (missing.length) return { ok: false, reason: "category_unconfirmed", detail: missing.join(", ") };
  return { ok: true, reason: "ok" };
}

/** Per-visitor decision for a country (ISO alpha-2, or null when unknown). */
export function countryDecision(p, country) {
  const s = providerStatus(p);
  if (!s.ok) return { eligible: false, reason: s.reason };
  if (typeof country !== "string" || !COUNTRY.test(country)) return { eligible: false, reason: "country_unknown" };
  const rule = p.countryRules.find((r) => r.country === country);
  if (rule && rule.rule === "suppress") return { eligible: false, reason: "country_suppressed" };
  return { eligible: true, reason: "eligible" };
}

export const OVERRIDE_TEST_VERIFIED = "test-verified";
const PRODUCTION_SITES = ["https://yonixtools.com", "https://www.yonixtools.com"];
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1|[a-z0-9-]+\.localhost)(:\d+)?$/i;

/**
 * TEST-ONLY override (NEXT_PUBLIC_ADS_POLICY_OVERRIDE=test-verified): lets the isolation e2e tests
 * render (stubbed) ads while the real policy is UNVERIFIED. Refused (throws, which fails the build)
 * unless the ad origin is a local http test origin and the site URL is not explicitly production.
 * Returns true when the override is active, false when unset.
 */
export function resolveOverride({ override, siteUrl, adOrigin }) {
  const o = (override || "").trim();
  if (!o) return false;
  if (o !== OVERRIDE_TEST_VERIFIED) throw new Error(`NEXT_PUBLIC_ADS_POLICY_OVERRIDE: unknown value '${o}' (only '${OVERRIDE_TEST_VERIFIED}', for local tests)`);
  const site = (siteUrl || "").trim().replace(/\/+$/, "").toLowerCase();
  if (PRODUCTION_SITES.includes(site)) throw new Error("NEXT_PUBLIC_ADS_POLICY_OVERRIDE is refused for a production build (NEXT_PUBLIC_SITE_URL is the production site)");
  const ad = (adOrigin || "").trim().replace(/\/$/, "");
  if (!LOCAL_ORIGIN.test(ad)) throw new Error("NEXT_PUBLIC_ADS_POLICY_OVERRIDE is allowed only with a local http test ad origin (e.g. http://localhost:4175)");
  return true;
}
