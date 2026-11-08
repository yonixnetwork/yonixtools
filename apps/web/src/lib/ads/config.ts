/**
 * Central advertising configuration. The Adsterra publisher snippets live,
 * verbatim, in ./units.json (also read by scripts/build-ad-frame.mjs).
 *
 * Each placement loads /ad-frame.html?u=<unit>&s=<slot> in a sandboxed iframe.
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
 * - "sandboxed" (default): opaque origin. The ad cannot read or change the page,
 *   use its storage, or navigate it; clicks open the advertiser in a new tab.
 * - "same-origin": the frame may use cookies/storage. Use only if /ads-check/
 *   shows units filling in this mode and not in the other.
 */
export type AdIsolation = "sandboxed" | "same-origin";
export const AD_ISOLATION: AdIsolation = process.env.NEXT_PUBLIC_AD_ISOLATION === "same-origin" ? "same-origin" : "sandboxed";

export const SANDBOX: Record<AdIsolation, string> = {
  sandboxed: "allow-scripts allow-popups allow-popups-to-escape-sandbox",
  "same-origin": "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox",
};

/** How long a unit may take to show something before its slot collapses (ad blocker, no fill, network error). */
export const FILL_TIMEOUT_MS = 9000;

export const adFrameUrl = (unit: AdUnitId, slotId: string) => `/ad-frame.html?u=${unit}&s=${encodeURIComponent(slotId)}`;
