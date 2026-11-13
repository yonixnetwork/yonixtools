import type { Metadata } from "next";
import { absoluteUrl, site, toolPath } from "./site";
import { getCategory, isIndexable, type Faq, type Tool } from "./registry";
import { categoryPath } from "./site";

/** The site-wide share image (1200x630), used by every page's Open Graph and X/Twitter card. */
export const OG_IMAGE = { url: "/og-image.png", width: 1200, height: 630, alt: "YoniXTools: free online tools for everyday tasks" };

/**
 * Complete metadata for an indexable page: canonical, Open Graph (with url and image) and a large
 * X/Twitter card. Next.js replaces a parent's openGraph/twitter instead of merging them, so every
 * page builds its own full set here.
 */
export function pageMetadata(p: { title: string; description: string; path: string; type?: "website" | "article"; absoluteTitle?: boolean; publishedTime?: string; modifiedTime?: string }): Metadata {
  return {
    title: p.absoluteTitle === false ? p.title : { absolute: p.title },
    description: p.description,
    alternates: { canonical: p.path },
    openGraph: {
      title: p.title, description: p.description, url: p.path, siteName: site.name, locale: "en_US", type: p.type ?? "website", images: [OG_IMAGE],
      ...(p.type === "article" ? { publishedTime: p.publishedTime, modifiedTime: p.modifiedTime } : {}),
    },
    twitter: { card: "summary_large_image", title: p.title, description: p.description, images: [OG_IMAGE.url] },
  };
}

/**
 * "<category description> N free tools: A, B, C and more." with as many tool names as fit in
 * 160 characters: never cut mid-word (the old version sliced at 160 and ended "…Facebook V").
 */
export function categoryDescription(base: string, names: string[], max = 160): string {
  const head = `${base} ${names.length} free tool${names.length === 1 ? "" : "s"}`;
  for (let n = Math.min(names.length, 4); n >= 1; n--) {
    const more = n < names.length ? " and more" : "";
    const listed = n === names.length && n > 1 ? `${names.slice(0, -1).join(", ")} and ${names[n - 1]}` : names.slice(0, n).join(", ");
    const out = `${head}: ${listed}${more}.`;
    if (out.length <= max) return out;
  }
  return base.length <= max ? base : base.slice(0, base.lastIndexOf(" ", max - 1)) + ".";
}

/** Add the brand only when the title stays within ~60 characters. */
export function brandedTitle(title: string) {
  const withBrand = `${title} | ${site.name}`;
  return withBrand.length <= 60 ? withBrand : title;
}

export function toolMetadata(tool: Tool): Metadata {
  const title = brandedTitle(tool.seo.title);
  return {
    ...pageMetadata({ title, description: tool.seo.description, path: toolPath(tool.slug) }),
    keywords: tool.keywords,
    robots: isIndexable(tool) ? { index: true, follow: true } : { index: false, follow: true },
  };
}

export function breadcrumbLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: absoluteUrl(c.path) })),
  };
}

export function faqLd(faqs: Faq[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}

export function toolLd(tool: Tool) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: tool.name,
    url: absoluteUrl(toolPath(tool.slug)),
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

export function toolBreadcrumbs(tool: Tool) {
  const cat = getCategory(tool.category);
  return [
    { name: "Home", path: "/" },
    { name: cat.name, path: categoryPath(cat.slug) },
    { name: tool.name, path: toolPath(tool.slug) },
  ];
}

export function websiteLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${site.url}/#website`,
    name: site.name,
    publisher: { "@id": `${site.url}/#organization` },
    url: absoluteUrl("/"),
    description: site.description,
    potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${absoluteUrl("/tools/")}?q={search_term_string}` }, "query-input": "required name=search_term_string" },
  };
}

/** Article schema for a guide: real dates, the site as author and publisher, no invented ratings. */
export function articleLd(g: { title: string; h1: string; description: string; published: string; updated: string; path: string }) {
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
    inLanguage: "en",
    author: { "@type": "Organization", name: site.name, url: absoluteUrl("/") },
    publisher: { "@id": `${site.url}/#organization` },
  };
}
