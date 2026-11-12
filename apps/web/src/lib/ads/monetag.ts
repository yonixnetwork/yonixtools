/**
 * Monetag zones. The exact publisher snippets live in ./monetag.json and are written
 * into the ad-origin document (scripts/build-ad-frame.mjs); they are never loaded
 * into this site's pages.
 *
 *  - In-Page Push (zone 12218944): runs in an isolated frame on the ad origin, shown as
 *    a collapsible slot on allowed utility pages only (see monetag-policy.ts).
 *  - Vignette (zone 12218952): an overlay over the whole page can't be isolated in a
 *    frame, and running it in the page would expose the page to ad code, so it is
 *    DISABLED on the site. The admin test page can still load it in a test frame.
 * Not used: MultiTag, Popunder, Push Notifications, Monetag's service worker.
 */
import { ADS_ENABLED } from "./config";

/** Build-time switch: NEXT_PUBLIC_MONETAG=on enables the In-Page Push slot (needs the ad origin too). */
export const MONETAG_ENABLED = ADS_ENABLED && process.env.NEXT_PUBLIC_MONETAG === "on";
