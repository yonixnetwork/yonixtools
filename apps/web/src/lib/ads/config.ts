/**
 * Central advertising configuration.
 *
 * Delivery: every ad unit (the four Adsterra units and Monetag In-Page Push) is
 * loaded in its own iframe from a SEPARATE ORIGIN (NEXT_PUBLIC_AD_ORIGIN, e.g.
 * https://ads.yonixtools.com), document /ad-frame.html?u=<unit>&s=<slot>. That
 * document writes the publisher's exact snippet (scripts/build-ad-frame.mjs), so
 * the ad code runs with an ordinary origin of its own (cookies, storage: what
 * Adsterra's code needs) while the browser's same-origin policy keeps it away
 * from this site's pages, pasted URLs, results, cookies and storage. The frame
 * has no top-navigation permission, so it can't redirect the page.
 *
 * Why not the earlier modes (evidence in docs/ADS_FIX_TEST_REPORT.md):
 *  - opaque-origin sandbox: Adsterra's code throws ("Service worker is disabled
 *    because the context is sandboxed…") and renders nothing: blank boxes;
 *  - frame on this site's own origin: ads render, but the ad code can read and
 *    hijack the page (tested).
 * So without a separate ad origin, NO ad slot renders at all (never a blank box).
 *
 * The publisher snippets live only in units.json / monetag.json and are written
 * into ad-frame.html at build time; they are not part of this site's bundles.
 * Disabled (never loaded): Popunder, Smartlink, Social Bar, Monetag MultiTag,
 * Monetag Push Notifications, Monetag Vignette (an overlay can't be isolated in a
 * frame; it is available on the admin test page only).
 */

export type AdUnitId = "native" | "banner300x250" | "banner728x90" | "banner320x50" | "monetagPush";

export interface AdUnit {
  id: AdUnitId;
  /** Reserved size. native/monetagPush: full width, height is the initial reservation. */
  width: number;
  height: number;
  fluid: boolean;
}

/** Sizes only (kept in sync with units.json by a unit test). */
export const AD_UNITS: Record<AdUnitId, AdUnit> = {
  native: { id: "native", width: 728, height: 100, fluid: true },
  banner300x250: { id: "banner300x250", width: 300, height: 250, fluid: false },
  banner728x90: { id: "banner728x90", width: 728, height: 90, fluid: false },
  banner320x50: { id: "banner320x50", width: 320, height: 50, fluid: false },
  monetagPush: { id: "monetagPush", width: 728, height: 120, fluid: true },
};

/**
 * Separate origin serving /ad-frame.html (build-time). Empty or invalid = ads off.
 * Must be https in production; http only for localhost tests.
 */
const rawAdOrigin = (process.env.NEXT_PUBLIC_AD_ORIGIN || "").replace(/\/$/, "");
export const AD_ORIGIN = /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(rawAdOrigin) || /^http:\/\/(localhost|127\.0\.0\.1|[a-z0-9-]+\.localhost)(:\d+)?$/i.test(rawAdOrigin) ? rawAdOrigin : "";

/** Ads render only when switched on AND an isolated ad origin is configured. */
export const ADS_ENABLED = (process.env.NEXT_PUBLIC_ADS || "on") !== "off" && AD_ORIGIN !== "";

/**
 * The frame keeps its OWN origin (allow-same-origin refers to the ad origin, not this
 * site); no allow-top-navigation of any kind; clicks open the advertiser in a new tab.
 */
export const AD_SANDBOX = "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox";

/** The ad frame decides "empty" after 8 s (Monetag: 14 s) without a real creative, or at once if its scripts fail. This is the page's safety net if the frame never reports. */
export const FILL_TIMEOUT_MS = 18000;

export const adFrameUrl = (unit: AdUnitId, slotId: string) => `${AD_ORIGIN}/ad-frame.html?u=${unit}&s=${encodeURIComponent(slotId)}`;
