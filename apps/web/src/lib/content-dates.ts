/**
 * When the content of each non-tool page last really changed (YYYY-MM-DD). Used for the sitemap's
 * lastmod: update a date only when that page's visible content changes, never just to look fresh.
 * Tool pages use Tool.updatedAt (or addedAt); guides use Guide.updated.
 */
export const PAGE_UPDATED = {
  home: "2026-11-13", // SEO pass: new description, guides links
  tools: "2026-11-13", // Twitch Clip Downloader added to the list
  categories: "2026-11-13", // category introductions added
  guides: "2026-11-13", // guides section published
  about: "2026-11-12",
  privacy: "2026-11-12",
} as const;
