import type { MetadataRoute } from "next";
import { categories, isIndexable, tools } from "@/lib/registry";
import { absoluteUrl, categoryPath, toolPath } from "@/lib/site";

export const dynamic = "force-static";

// Only pages that are fully working are listed. Downloader pages join the
// sitemap automatically when their status becomes "live".
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-11-06");
  return [
    { url: absoluteUrl("/"), lastModified, changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/tools/"), lastModified, changeFrequency: "weekly", priority: 0.8 },
    ...categories.map((c) => ({ url: absoluteUrl(categoryPath(c.slug)), lastModified, changeFrequency: "monthly" as const, priority: 0.6 })),
    ...tools.filter(isIndexable).map((t) => ({ url: absoluteUrl(toolPath(t.slug)), lastModified: new Date(t.addedAt), changeFrequency: "monthly" as const, priority: 0.7 })),
    { url: absoluteUrl("/about/"), lastModified, changeFrequency: "monthly", priority: 0.4 },
    { url: absoluteUrl("/privacy/"), lastModified, changeFrequency: "yearly", priority: 0.2 },
  ];
}
