import type { MetadataRoute } from "next";
import { PAGE_UPDATED } from "@/lib/content-dates";
import { getGuide } from "@/lib/guides";
import { categories, getTool, isIndexable, toolsInCategory } from "@/lib/registry";
import { absoluteUrl } from "@/lib/site";
import { builtLocales } from "@/i18n/catalogue";
import { allPages, hreflangFor, isIndexableIn, pathFor, type PageRef } from "@/i18n/routes";

export const dynamic = "force-static";

/**
 * Every indexable public page in every language, generated from the same registries the pages are
 * built from. A localized page appears only once it is indexable (catalogue complete AND every key
 * it shows reviewed by a person); machine translations never do. Each entry lists its indexable
 * language versions (xhtml:link alternates, reciprocal by construction, + x-default = English).
 * Left out: noindex pages (unsupported platforms, the offline page), admin, API, ad documents and
 * search-result URLs. lastmod is the date the page's content last really changed.
 */
function lastModified(p: PageRef): string {
  switch (p.kind) {
    case "home": return PAGE_UPDATED.home;
    case "tools": return PAGE_UPDATED.tools;
    case "category": return PAGE_UPDATED.categories;
    case "tool": { const t = getTool(p.slug)!; return t.updatedAt ?? t.addedAt; }
    case "guides": return PAGE_UPDATED.guides;
    case "guide": return getGuide(p.slug)!.updated;
    case "about": return PAGE_UPDATED.about;
    case "privacy": return PAGE_UPDATED.privacy;
    default: return PAGE_UPDATED.home;
  }
}

function listed(p: PageRef): boolean {
  if (p.kind === "category") return toolsInCategory(p.id).some(isIndexable) && categories.some((c) => c.id === p.id);
  return p.kind !== "offline";
}

export default function sitemap(): MetadataRoute.Sitemap {
  const d = (s: string) => new Date(`${s}T00:00:00Z`);
  const out: MetadataRoute.Sitemap = [];
  for (const locale of builtLocales()) {
    for (const p of allPages()) {
      if (!listed(p) || !isIndexableIn(locale, p)) continue;
      const langs = hreflangFor(p);
      out.push({
        url: absoluteUrl(pathFor(locale, p)),
        lastModified: d(lastModified(p)),
        ...(Object.keys(langs).length ? { alternates: { languages: Object.fromEntries(Object.entries(langs).map(([k, v]) => [k, absoluteUrl(v)])) } } : {}),
      });
    }
  }
  return out;
}
