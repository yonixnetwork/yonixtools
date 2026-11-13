import type { Metadata } from "next";
import { absoluteUrl, site, toolPath } from "./site";
import { getCategory, isIndexable, type Faq, type Tool } from "./registry";
import { categoryPath } from "./site";

/** Add the brand only when the title stays within ~60 characters. */
export function brandedTitle(title: string) {
  const withBrand = `${title} | ${site.name}`;
  return withBrand.length <= 60 ? withBrand : title;
}

export function toolMetadata(tool: Tool): Metadata {
  const url = toolPath(tool.slug);
  const title = brandedTitle(tool.seo.title);
  return {
    title: { absolute: title },
    description: tool.seo.description,
    keywords: tool.keywords,
    alternates: { canonical: url },
    robots: isIndexable(tool) ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: { title, description: tool.seo.description, url, type: "website", siteName: site.name },
    twitter: { card: "summary", title, description: tool.seo.description },
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
    publisher: { "@type": "Organization", name: site.name, url: site.url },
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
    name: site.name,
    url: absoluteUrl("/"),
    description: site.description,
    potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${absoluteUrl("/tools/")}?q={search_term_string}` }, "query-input": "required name=search_term_string" },
  };
}
