import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { builtLocales } from "@/i18n/catalogue";
import { getLocale, localeFromPrefix } from "@/i18n/locales";
import { allPages, pathFor, resolvePath, type PageRef } from "@/i18n/routes";
import { CategoryView, ToolsView, categoryMetadata, toolsMetadata } from "@/views/ListingViews";
import { ToolView, toolPageMetadata } from "@/views/ToolView";
import { AboutView, GuideView, GuidesView, OfflineView, PrivacyView, aboutMetadata, guideMetadata, guidesMetadata, offlineMetadata, privacyMetadata } from "@/views/ContentViews";

/** Every page of every built non-English locale below its home page: /<prefix>/<localized path>/. */
export const dynamicParams = false;

export function generateStaticParams() {
  const out: Array<{ slug: string; path: string[] }> = [];
  for (const l of builtLocales()) {
    if (l === "en") continue;
    const prefix = getLocale(l).prefix;
    for (const p of allPages()) {
      if (p.kind === "home") continue;
      const segs = pathFor(l, p).split("/").filter(Boolean).slice(1);
      out.push({ slug: prefix, path: segs.map(decodeURIComponent) });
    }
  }
  // A static export needs at least one route here; with no translated locale built (English-only
  // build), emit one placeholder that renders the 404 page.
  return out.length ? out : [{ slug: "_none", path: ["_none"] }];
}

type Props = { params: Promise<{ slug: string; path: string[] }> };

async function resolve(params: Props["params"]): Promise<{ locale: string; page: PageRef } | null> {
  const { slug, path } = await params;
  const loc = localeFromPrefix(slug);
  if (!loc || loc.code === "en" || !builtLocales().includes(loc.code)) return null;
  const page = resolvePath(loc.code, `/${loc.prefix}/${path.map(decodeURIComponent).join("/")}/`);
  return page && page.kind !== "home" ? { locale: loc.code, page } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = await resolve(params);
  if (!r) return {};
  const { locale, page: p } = r;
  switch (p.kind) {
    case "tools": return toolsMetadata(locale);
    case "category": return categoryMetadata(locale, p.id);
    case "tool": return toolPageMetadata(locale, p.slug);
    case "guides": return guidesMetadata(locale);
    case "guide": return guideMetadata(locale, p.slug);
    case "about": return aboutMetadata(locale);
    case "privacy": return privacyMetadata(locale);
    case "offline": return offlineMetadata(locale);
    default: return {};
  }
}

export default async function LocalizedPage({ params }: Props) {
  const r = await resolve(params);
  if (!r) notFound();
  const { locale, page: p } = r;
  switch (p.kind) {
    case "tools": return <ToolsView locale={locale} />;
    case "category": return <CategoryView locale={locale} id={p.id} />;
    case "tool": return <ToolView locale={locale} slug={p.slug} />;
    case "guides": return <GuidesView locale={locale} />;
    case "guide": return <GuideView locale={locale} slug={p.slug} />;
    case "about": return <AboutView locale={locale} />;
    case "privacy": return <PrivacyView locale={locale} />;
    case "offline": return <OfflineView locale={locale} />;
    default: notFound();
  }
}
