/**
 * Advertising policy gate (owner requirement, 14 Nov 2026): every Adsterra unit stays suppressed
 * until written confirmation proves the required categories can be blocked. The policy itself is
 * config/ads-policy.json (copied here as ./ads-policy.json by scripts/sync-ads-policy.sh; a unit
 * test fails if the copies differ). See docs/ADVERTISING_SAFETY_REPORT.md.
 *
 * Two levels, both fail closed:
 *  1. Build time (this module): if the provider is not VERIFIED with evidence for every required
 *     category, ADS_POLICY_OK is false, config.ts turns ADS_ENABLED off, no ad slot renders and the
 *     public ad frame is built without any ad code (scripts/build-ad-frame.mjs).
 *  2. Page view (eligibility.ts): once verified, each slot first asks this site's backend
 *     (/api/v1/ad-eligibility, country from DB-IP Lite, server-side) and renders only on an
 *     explicit "eligible" for this policy version. Errors, timeouts or unknown country: no ad.
 *
 * NEXT_PUBLIC_ADS_POLICY_OVERRIDE=test-verified is for local e2e builds only (stubbed ad networks);
 * resolveOverride() throws, failing the build, for a production site URL or a non-local ad origin.
 */
import policy from "./ads-policy.json";
import { providerStatus, resolveOverride } from "./policy-core.mjs";

export const ADS_POLICY = policy;
export const ADS_POLICY_VERSION: number = policy.version;

// Direct process.env.NEXT_PUBLIC_* reads so Next inlines the same values into server and client code.
export const ADS_POLICY_OVERRIDE = resolveOverride({
  override: process.env.NEXT_PUBLIC_ADS_POLICY_OVERRIDE,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
  adOrigin: process.env.NEXT_PUBLIC_AD_ORIGIN,
});

const status = providerStatus(policy);
/** Why ads are (not) allowed by the policy in this build. */
export const ADS_POLICY_REASON: string = ADS_POLICY_OVERRIDE ? "test_override" : status.reason;
/** True only when the provider is verified for every required category (or the local test override). */
export const ADS_POLICY_OK: boolean = ADS_POLICY_OVERRIDE || status.ok;
