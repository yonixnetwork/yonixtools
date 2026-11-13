import type { MetadataRoute } from "next";
import { PAGE_UPDATED } from "@/lib/content-dates";
import { guides } from "@/lib/guides";
import { categories, isIndexable, tools, toolsInCategory } from "@/lib/registry";
import { absoluteUrl, categoryPath, toolPath } from "@/lib/site";

export const dynamic = "force-static";

/**
 * Every indexable public page, generated from the same registries the pages are built from, so a
 * tool or guide added, hidden or removed updates the sitemap automatically. Left out: noindex pages
 * (unsupported platforms, the offline page), admin, API, ad documents and search-result URLs.
 * lastmod is the date the page's content last really changed (see lib/content-dates.ts).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const d = (s: string) => new Date(`${s}T00:00:00Z`);
  const live = tools.filter(isIndexable);
  return [
    { url: absoluteUrl("/"), lastModified: d(PAGE_UPDATED.home) },
    { url: absoluteUrl("/tools/"), lastModified: d(PAGE_UPDATED.tools) },
    ...categories.filter((c) => toolsInCategory(c.id).some(isIndexable)).map((c) => ({ url: absoluteUrl(categoryPath(c.slug)), lastModified: d(PAGE_UPDATED.categories) })),
    ...live.map((t) => ({ url: absoluteUrl(toolPath(t.slug)), lastModified: d(t.updatedAt ?? t.addedAt) })),
    { url: absoluteUrl("/guides/"), lastModified: d(PAGE_UPDATED.guides) },
    ...guides.map((g) => ({ url: absoluteUrl(`/guides/${g.slug}/`), lastModified: d(g.updated) })),
    { url: absoluteUrl("/about/"), lastModified: d(PAGE_UPDATED.about) },
    { url: absoluteUrl("/privacy/"), lastModified: d(PAGE_UPDATED.privacy) },
  ];
}
