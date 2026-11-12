/**
 * CENTRAL AD PLACEMENT CONFIGURATION: the one place to move, add or switch off ads.
 *
 * Pages only declare positions (<AdPlacement page="tool" position="after-tool" />); what
 * appears there, on which devices, is decided here. A placement that is disabled, or
 * whose network/format is off in this build, renders nothing at all (and loads nothing).
 *
 * Rules kept by this table (and enforced by tests/e2e/ad-spacing.spec.ts and
 * tests/unit/placements.test.ts):
 *  - never two ads next to each other: there is always page content between placements;
 *  - each zone at most once per page (no repeated units), at most one native unit;
 *  - at most LIMITS.adsterraPerPage (2) Adsterra ads per page per device;
 *  - Monetag (In-Page Push, Vignette) OFF unless the administrator builds with MONETAG=on;
 *  - Monetag only where monetag-policy allows it (never on pages with the downloader);
 *  - no ads inside tools, over inputs, previews, quality choices or Download buttons.
 *
 * Devices: "mobile" < 768 px, "desktop" >= 768 px (tablets in landscape count as desktop).
 * Format "leaderboard" = 320 x 50 on mobile, 728 x 90 on desktop (never a stretched banner).
 * The native unit is desktop-only: on phones it stacks its 4 tiles into one tall column.
 */
import type { AdUnitId } from "./config";

export type PageType = "home" | "tool" | "downloader" | "listing";
export type Device = "mobile" | "desktop";
export type Network = "adsterra" | "monetag";
export type Format = Exclude<AdUnitId, "banner320x50" | "banner728x90"> | "leaderboard";

export interface Placement {
  /** Stable id, also used in the anonymous delivery counts (page.position). */
  id: string;
  page: PageType;
  position: string;
  network: Network;
  format: Format;
  devices: Device[];
  enabled: boolean;
  /** Why it is where it is (or why it is off). */
  note: string;
}

/** Listing grids: the in-grid break follows this many cards, and only in lists at least this long. */
export const GRID_AD_AFTER = 6;
export const GRID_AD_MIN = 9;

/** Owner rule for the initial release (12 Nov 2026): at most TWO Adsterra placements per page. */
export const LIMITS = { adsterraPerPage: 2, nativePerPage: 1 } as const;

export const PLACEMENTS: Placement[] = [
  // Home: one after the introduction (the downloader hero), one between content sections.
  { id: "home.after-hero", page: "home", position: "after-hero", network: "adsterra", format: "leaderboard", devices: ["mobile", "desktop"], enabled: true, note: "below the downloader hero, never over the URL box" },
  { id: "home.mid-content", page: "home", position: "mid-content", network: "adsterra", format: "banner300x250", devices: ["mobile", "desktop"], enabled: true, note: "between Popular tools and Browse by category" },

  // Utility tools (PDF, image, video, developer, ...): one below the introduction, one below the tool and its result.
  { id: "tool.before-tool", page: "tool", position: "before-tool", network: "adsterra", format: "leaderboard", devices: ["mobile", "desktop"], enabled: true, note: "between the tool heading and the tool, with space; never inside the tool" },
  { id: "tool.after-tool", page: "tool", position: "after-tool", network: "adsterra", format: "banner300x250", devices: ["mobile", "desktop"], enabled: true, note: "below the tool and its result, before the article" },

  // Downloader pages: nothing over the URL box, preview, status or Download buttons; never Monetag.
  { id: "downloader.after-result", page: "downloader", position: "after-result", network: "adsterra", format: "leaderboard", devices: ["mobile", "desktop"], enabled: true, note: "below the downloader and its completed results" },
  { id: "downloader.content", page: "downloader", position: "content-1", network: "adsterra", format: "banner300x250", devices: ["mobile", "desktop"], enabled: true, note: "natural content position: between How to use and Features" },
  { id: "downloader.panel", page: "downloader", position: "download-panel", network: "adsterra", format: "banner300x250", devices: ["mobile", "desktop"], enabled: false, note: "OFF (owner): no ads when Download is clicked or during processing" },

  // All tools and category pages: a clearly separated break between groups of tools (long lists), one after the list.
  { id: "listing.in-grid", page: "listing", position: "in-grid", network: "adsterra", format: "leaderboard", devices: ["mobile", "desktop"], enabled: true, note: "full-width break after the first 6 tools (lists of 9+: All tools, Developer, SEO)" },
  { id: "listing.after-list-native", page: "listing", position: "after-list", network: "adsterra", format: "native", devices: ["desktop"], enabled: true, note: "after the tool list (wide screens: one row of tiles)" },
  { id: "listing.after-list", page: "listing", position: "after-list", network: "adsterra", format: "banner300x250", devices: ["mobile"], enabled: true, note: "after the tool list on phones" },

  // Monetag: OFF for the initial release. This row only renders when the administrator builds with
  // MONETAG=on (default off), and never on the homepage or downloader pages. If Monetag is re-enabled,
  // remove one Adsterra row on tool pages to stay within two ads.
  { id: "tool.content-monetag", page: "tool", position: "content-1", network: "monetag", format: "monetagPush", devices: ["desktop"], enabled: true, note: "only with MONETAG=on: between How to use and Features (isolated frame)" },
];

export function placementsFor(page: PageType, position: string): Placement[] {
  return PLACEMENTS.filter((p) => p.enabled && p.page === page && p.position === position);
}
