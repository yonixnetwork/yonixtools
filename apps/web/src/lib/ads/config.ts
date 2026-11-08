/**
 * Central advertising configuration. The Adsterra publisher snippets live,
 * verbatim, in ./units.json (also read by scripts/build-ad-frame.mjs).
 *
 * Each placement loads /ad-frame.html?u=<unit>&s=<slot> in its own iframe.
 * That document writes the exact snippet while parsing, so:
 *  - every banner gets its own window: no shared `atOptions`, no overwriting;
 *  - the native unit's fixed container id exists once per frame: no collisions;
 *  - only that document has an ad-friendly CSP; the site keeps its strict one.
 * One instance per unit per page.
 *
 * Disabled (never loaded): Popunder, Smartlink, Social Bar.
 */
import units from "./units.json";

export type AdUnitId = "native" | "banner300x250" | "banner728x90" | "banner320x50";

export interface AdUnit {
  id: AdUnitId;
  label: string;
  width: number; // reserved size (native: max width; height is the initial reservation)
  height: number;
  snippet: string;
}

export const AD_UNITS = Object.fromEntries(Object.entries(units).map(([id, u]) => [id, { id, ...u }])) as Record<AdUnitId, AdUnit>;

/** Build-time switch: NEXT_PUBLIC_ADS=off disables every ad (e.g. for a staging build). */
export const ADS_ENABLED = (process.env.NEXT_PUBLIC_ADS || "on") !== "off";

/**
 * How each unit's frame is isolated from the page.
 * - "same-origin" (default): the frame runs on this site's origin, so the
 *   publisher scripts get the cookies, storage, service-worker and top-window
 *   access they need. Measured on the live site (scripts/ads/inspect-prod.mjs):
 *   in the opaque-origin sandbox Adsterra's code throws ("Service worker is
 *   disabled because the context is sandboxed and lacks the 'allow-same-origin'
 *   flag") and renders nothing. The frame still has no top-navigation right and
 *   pages keep their strict CSP, so the ad can't inject scripts into them; it
 *   can, however, read the embedding page (as any directly embedded ad tag can).
 * - "sandboxed": opaque origin, full isolation. Adsterra's scripts fail in it;
 *   kept for comparison on /ads-check/ only.
 */
export type AdIsolation = "sandboxed" | "same-origin";
export const AD_ISOLATION: AdIsolation = process.env.NEXT_PUBLIC_AD_ISOLATION === "sandboxed" ? "sandboxed" : "same-origin";

export const SANDBOX: Record<AdIsolation, string> = {
  sandboxed: "allow-scripts allow-popups allow-popups-to-escape-sandbox",
  "same-origin": "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox",
};

/** The ad frame decides "empty" after this long without a real creative (8 s), or at once if its scripts fail. This is the page's safety net if the frame never reports. */
export const FILL_TIMEOUT_MS = 12000;

/** Native units have no fixed size: reserve a small strip while loading and grow to the creative's real height. */
export const NATIVE_RESERVE_PX = 100;

export const adFrameUrl = (unit: AdUnitId, slotId: string) => `/ad-frame.html?u=${unit}&s=${encodeURIComponent(slotId)}`;

export interface AdDiag {
  scripts: Record<string, { state: "loaded" | "failed"; ms: number }>;
  errors: string[];
  nodes: string[];
  access: { origin: string; cookies: string; storage: string; top: string };
  ms: number;
}
