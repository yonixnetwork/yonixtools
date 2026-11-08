import { allTools, getCategory, type CategoryId, type Tool } from "@/lib/registry";
import { categoryPath, toolPath } from "@/lib/site";
import { MONETAG_ENABLED } from "./monetag";

/**
 * CENTRAL RULE (owner decision, 8 Nov 2026): Monetag never runs where people paste or
 * process media URLs: the homepage (it embeds the downloader), every downloader page
 * (category "social", results included) and the downloader category page. Allowed:
 * ordinary utility pages (PDF, image, SEO, developer, other tools), All tools, other
 * category pages, and the /ads-check/ diagnostics page.
 * Enforced three times: here (MonetagZones renders nothing otherwise), at runtime in the
 * loader (path deny-list + downloader DOM marker), and by tests over every built page.
 */
export type MonetagPage = { kind: "home" } | { kind: "tool"; tool: Tool } | { kind: "category"; id: CategoryId } | { kind: "tools" } | { kind: "diagnostics" };

const MEDIA_URL_CATEGORY: CategoryId = "social";
/** Every path where media URLs are pasted or processed (built from the registry, so new downloaders are covered). */
export const MONETAG_DENIED_PATHS: string[] = ["/", categoryPath(getCategory(MEDIA_URL_CATEGORY).slug), ...allTools.filter((t) => t.category === MEDIA_URL_CATEGORY).map((t) => toolPath(t.slug))];
/** The downloader (URL box and results) carries data-ytx-media-input; the loader refuses any page that has it. */

export function monetagAllowed(page: MonetagPage): boolean {
  if (!MONETAG_ENABLED) return false;
  switch (page.kind) {
    case "home":
      return false;
    case "tool":
      return page.tool.category !== MEDIA_URL_CATEGORY && !page.tool.hidden;
    case "category":
      return page.id !== MEDIA_URL_CATEGORY;
    case "tools":
    case "diagnostics":
      return true;
  }
}

