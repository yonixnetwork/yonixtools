import type { Metadata } from "next";
import { absoluteUrl, site } from "./site";
import { getCategory, type Faq, type Tool } from "./registry";
import { getLocale } from "@/i18n/locales";
import { hreflangFor, isIndexableIn, pathFor, type PageRef } from "@/i18n/routes";
import { builtLocales } from "@/i18n/catalogue";
import { getT, loadNamespace } from "@/i18n/server";
import { localizeCategory } from "@/i18n/source";

/** The site-wide share image (1200x630), used by every page's Open Graph and X/Twitter card. */
export const OG_IMAGE = { url: "/og-image.png", width: 1200, height: 630, alt: "YoniXTools: free online tools for everyday tasks" };

/**
 * Complete metadata for a page in one locale: self-referencing canonical, reciprocal hreflang for
 * the page's INDEXABLE language versions (+ x-default = English), robots (noindex for translations
 * that are not human-reviewed), Open Graph (with url, image, locale and alternate locales) and a
 * large X/Twitter card. Next.js replaces a parent's openGraph/twitter instead of merging them, so
 * every page builds its own full set here.
 */
export function pageMetadata(p: {
  title: string;
  description: string;
  /** The page; its path in `locale` becomes the canonical URL. */
  page: PageRef;
  locale?: string;
  type?: "website" | "article";
  absoluteTitle?: boolean;
  publishedTime?: string;
  modifiedTime?: string;
  /** Force noindex (page-specific reasons, e.g. an unavailable platform). */
  noindex?: boolean;
}): Metadata {
  const locale = p.locale ?? "en";
  const path = pathFor(locale, p.page);
  const indexable = !p.noindex && isIndexableIn(locale, p.page);
  const languages = indexable ? hreflangFor(p.page) : {};
  const others = indexable ? builtLocales().filter((l) => l !== locale && isIndexableIn(l, p.page)).map((l) => getLocale(l).og) : [];
  const ogImage = { ...OG_IMAGE, alt: locale === "en" ? OG_IMAGE.alt : getT(locale, "pages")("meta.ogImageAlt") };
  return {
    title: p.absoluteTitle === false ? p.title : { absolute: p.title },
    description: p.description,
    alternates: { canonical: path, ...(Object.keys(languages).length ? { languages } : {}) },
    ...(indexable ? {} : { robots: { index: false, follow: true } }),
    openGraph: {
      title: p.title, description: p.description, url: path, siteName: site.name, locale: getLocale(locale).og, ...(others.length ? { alternateLocale: others } : {}), type: p.type ?? "website", images: [ogImage],
      ...(p.type === "article" ? { publishedTime: p.publishedTime, modifiedTime: p.modifiedTime } : {}),
    },
    twitter: { card: "summary_large_image", title: p.title, description: p.description, images: [OG_IMAGE.url] },
  };
}

/**
 * "<category description> N free tools: A, B, C and more." with as many tool names as fit in
 * 160 characters: never cut mid-word (the old version sliced at 160 and ended "…Facebook V").
 */
export function categoryDescription(base: string, names: string[], max = 160, locale = "en"): string {
  const t = getT(locale, "pages");
  const head = `${base} ${t("meta.freeTools", { count: names.length })}`;
  const list = new Intl.ListFormat(getLocale(locale).code, { type: "conjunction" });
  for (let n = Math.min(names.length, 4); n >= 1; n--) {
    // English keeps its established wording ("A, B and C"); other languages use Intl.ListFormat.
    const all = n === names.length;
    const joined = locale === "en" ? (all && n > 1 ? `${names.slice(0, -1).join(", ")} and ${names[n - 1]}` : names.slice(0, n).join(", ")) : list.format(names.slice(0, n));
    const listed = all ? joined : t("meta.andMore", { list: locale === "en" ? joined : names.slice(0, n).join(", ") });
    const out = `${head}: ${listed}.`;
    if (out.length <= max) return out;
  }
  if (base.length <= max) return base;
  const cut = base.lastIndexOf(" ", max - 1);
  return (cut > 0 ? base.slice(0, cut) : base.slice(0, max - 1)) + (locale === "en" ? "." : "…");
}

/** Add the brand only when the title stays within ~60 characters. */
export function brandedTitle(title: string) {
  const withBrand = `${title} | ${site.name}`;
  return withBrand.length <= 60 ? withBrand : title;
}

/** `tool` must already be localized (i18n/source localizeTool) for non-English locales. */
export function toolMetadata(tool: Tool, locale = "en"): Metadata {
  const title = brandedTitle(tool.seo.title);
  const meta = pageMetadata({ title, description: tool.seo.description, page: { kind: "tool", slug: tool.slug }, locale });
  return { ...meta, ...(locale === "en" ? { keywords: tool.keywords } : {}), robots: meta.robots ?? { index: true, follow: true } };
}

export function breadcrumbLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: absoluteUrl(c.path) })),
  };
}

export function faqLd(faqs: Faq[], locale = "en") {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: getLocale(locale).code,
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}

export function toolLd(tool: Tool, locale = "en") {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: tool.name,
    inLanguage: getLocale(locale).code,
    url: absoluteUrl(pathFor(locale, { kind: "tool", slug: tool.slug })),
    description: tool.seo.description,
    applicationCategory: tool.category === "developer" ? "DeveloperApplication" : tool.category === "calculators" ? "FinanceApplication" : "UtilitiesApplication",
    operatingSystem: "Any (web browser)",
    browserRequirements: "Requires JavaScript",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    publisher: { "@id": `${site.url}/#organization` },
  };
}

/** The publisher. Only facts that are true: name, address, logo. (No social profiles exist to list.) */
export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${site.url}/#organization`,
    name: site.name,
    url: absoluteUrl("/"),
    logo: { "@type": "ImageObject", url: absoluteUrl("/icons/icon-512.png"), width: 512, height: 512 },
  };
}

/** `tool` localized for the locale; the category name is localized here. */
export function toolBreadcrumbs(tool: Tool, locale = "en") {
  const cat = localizeCategory(getCategory(tool.category), loadNamespace(locale, "registry"));
  return [
    { name: getT(locale, "pages")("crumb.home"), path: pathFor(locale, { kind: "home" }) },
    { name: cat.name, path: pathFor(locale, { kind: "category", id: cat.id }) },
    { name: tool.name, path: pathFor(locale, { kind: "tool", slug: tool.slug }) },
  ];
}

export function websiteLd(locale = "en") {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${site.url}/#website`,
    name: site.name,
    inLanguage: getLocale(locale).code,
    publisher: { "@id": `${site.url}/#organization` },
    url: absoluteUrl(pathFor(locale, { kind: "home" })),
    description: locale === "en" ? site.description : getT(locale, "pages")("home.metaDescription"),
    potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${absoluteUrl(pathFor(locale, { kind: "tools" }))}?q={search_term_string}` }, "query-input": "required name=search_term_string" },
  };
}

/** Article schema for a guide: real dates, the site as author and publisher, no invented ratings. */
export function articleLd(g: { title: string; h1: string; description: string; published: string; updated: string; path: string }, locale = "en") {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: g.h1.length <= 110 ? g.h1 : g.title,
    description: g.description,
    datePublished: g.published,
    dateModified: g.updated,
    mainEntityOfPage: absoluteUrl(g.path),
    url: absoluteUrl(g.path),
    image: absoluteUrl(OG_IMAGE.url),
    inLanguage: getLocale(locale).code,
    author: { "@type": "Organization", name: site.name, url: absoluteUrl("/") },
    publisher: { "@id": `${site.url}/#organization` },
  };
}
