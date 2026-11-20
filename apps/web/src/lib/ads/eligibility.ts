import { site } from "@/lib/site";
import { ADS_POLICY_OVERRIDE, ADS_POLICY_VERSION } from "./policy";

/**
 * Per-page-view ad eligibility (see policy.ts). Asked once per loaded document, before any ad
 * frame is created; every slot waits for the same answer. Only {eligible} is kept, in memory:
 * no IP, no country, nothing stored in the browser. Anything but an explicit
 * {eligible: true, policyVersion: <this build's policy>} within the timeout means no ads.
 */
export const ELIGIBILITY_TIMEOUT_MS = 3000;

const api = site.downloaderApiUrl || (ADS_POLICY_OVERRIDE ? "/api" : "");
/** Empty when this build has no backend: no eligibility answer, so no ads. */
export const ELIGIBILITY_URL = api ? `${api}/v1/ad-eligibility` : "";

let decision: Promise<boolean> | null = null;

async function ask(): Promise<boolean> {
  if (!ELIGIBILITY_URL) return false;
  const ctl = new AbortController();
  const t = window.setTimeout(() => ctl.abort(), ELIGIBILITY_TIMEOUT_MS);
  try {
    const r = await fetch(ELIGIBILITY_URL, { method: "GET", credentials: "omit", cache: "no-store", signal: ctl.signal });
    if (!r.ok) return false;
    const j = (await r.json()) as { eligible?: unknown; policyVersion?: unknown };
    return j !== null && typeof j === "object" && j.eligible === true && j.policyVersion === ADS_POLICY_VERSION;
  } catch {
    return false;
  } finally {
    window.clearTimeout(t);
  }
}

export function adsEligible(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (!decision) decision = ask();
  return decision;
}
