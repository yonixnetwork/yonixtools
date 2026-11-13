import { site } from "@/lib/site";

/**
 * Anonymous ad-delivery counts: how each placement ended on this device class.
 * Sent in small batches to this site's own backend (never to a third party), only
 * when a backend is configured. Contains a placement id, the unit, the outcome and
 * "mobile"/"desktop": no URL, no identifiers, nothing about the visitor. These are not
 * impressions, clicks or revenue; those numbers come from the ad networks' dashboards.
 */
export type AdOutcome = "requested" | "filled" | "empty" | "blocked";
type Ev = { p: string; u: string; o: AdOutcome; d: "mobile" | "desktop" };

const queue: Ev[] = [];
let timer: number | undefined;
let hooked = false;

export function reportAd(placement: string | undefined, unit: string, o: AdOutcome) {
  if (!placement || !site.downloaderApiUrl || typeof window === "undefined") return;
  queue.push({ p: placement, u: unit, o, d: window.matchMedia("(min-width: 768px)").matches ? "desktop" : "mobile" });
  if (!hooked) {
    hooked = true;
    addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush());
  }
  window.clearTimeout(timer);
  timer = window.setTimeout(flush, 10_000);
}

function flush() {
  if (!queue.length) return;
  const body = JSON.stringify({ events: queue.splice(0, 12) });
  try {
    fetch(`${site.downloaderApiUrl}/v1/ad-events`, { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true, credentials: "omit" }).catch(() => {});
  } catch {
    /* reporting must never affect the page */
  }
  if (queue.length) flush();
}
