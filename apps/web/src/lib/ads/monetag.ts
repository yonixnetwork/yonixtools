/**
 * Monetag zones (Vignette Banner and In-Page Push). The publisher snippets live,
 * verbatim, in ./monetag.json; a test compares them with the supplied code.
 *
 * Both formats draw over the page (overlay / notification-style banner), so they
 * run in the page itself, not in an ad frame like the Adsterra units. Each zone
 * is loaded at most once per page: a page-level guard wraps the unchanged
 * snippet, and the loader runs after the page is idle (never blocks the app).
 * Frequency and appearance are controlled in the Monetag dashboard.
 *
 * Not used: Monetag MultiTag, Popunder, (Web) Push Notifications, and the
 * Monetag service worker (the site's own PWA service worker stays unchanged).
 */
import zones from "./monetag.json";
import { ADS_ENABLED } from "./config";

export type MonetagZoneId = keyof typeof zones;
export const MONETAG_ZONES = zones as Record<MonetagZoneId, { label: string; zone: string; src: string; snippet: string }>;

/** Build-time switch: NEXT_PUBLIC_MONETAG=off removes both zones (ADS=off removes every ad). */
export const MONETAG_ENABLED = ADS_ENABLED && (process.env.NEXT_PUBLIC_MONETAG || "on") !== "off";

/** The snippet's own code (between its <script> tags), unchanged, inside a once-per-page guard. */
export function guardedSnippet(id: MonetagZoneId): string {
  const { zone, snippet } = MONETAG_ZONES[id];
  const code = snippet.replace(/^<script>\n/, "").replace(/\n<\/script>$/, "");
  return `(function(){var w=window,k=${JSON.stringify(zone)};w.__ytxMonetag=w.__ytxMonetag||{};if(w.__ytxMonetag[k]||document.querySelector('script[data-zone="'+k+'"]'))return;w.__ytxMonetag[k]=1;\n${code}\n})();`;
}
