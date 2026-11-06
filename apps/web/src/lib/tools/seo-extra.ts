import { escapeHtml } from "./formats";

// ── Sitemap ─────────────────────────────────────────────────────────────────

export interface SitemapOptions {
  lastmod?: string; // YYYY-MM-DD
  changefreq?: "" | "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

const xmlEscape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export function parseUrlList(text: string): { urls: string[]; invalid: string[] } {
  const urls: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    try {
      const u = new URL(t);
      if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error();
      u.hash = "";
      const s = u.toString();
      if (!seen.has(s)) (seen.add(s), urls.push(s));
    } catch {
      invalid.push(t);
    }
  }
  return { urls, invalid };
}

export function sitemapXml(urls: string[], o: SitemapOptions = {}): string {
  if (urls.length > 50_000) throw new Error("A sitemap can list at most 50,000 URLs. Split it into several files.");
  const body = urls
    .map((u) => {
      const parts = [`    <loc>${xmlEscape(u)}</loc>`];
      if (o.lastmod) parts.push(`    <lastmod>${o.lastmod}</lastmod>`);
      if (o.changefreq) parts.push(`    <changefreq>${o.changefreq}</changefreq>`);
      if (o.priority) parts.push(`    <priority>${o.priority}</priority>`);
      return `  <url>\n${parts.join("\n")}\n  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

// ── Schema.org JSON-LD ──────────────────────────────────────────────────────

export type SchemaType = "Organization" | "LocalBusiness" | "Article" | "Product" | "FAQPage" | "Event" | "Person";

const clean = (o: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(o)
      .map(([k, v]) => [k, v && typeof v === "object" && !Array.isArray(v) ? clean(v as Record<string, unknown>) : v])
      .filter(([, v]) => v !== "" && v !== undefined && v !== null && !(Array.isArray(v) && !v.length) && !(typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0)),
  );

export function schemaJsonLd(type: SchemaType, f: Record<string, string>, faqs: Array<{ q: string; a: string }> = []): Record<string, unknown> {
  const lines = (s?: string) => (s || "").split("\n").map((x) => x.trim()).filter(Boolean);
  const base = { "@context": "https://schema.org", "@type": type };
  switch (type) {
    case "Organization":
      return clean({ ...base, name: f.name, url: f.url, logo: f.logo, description: f.description, email: f.email, telephone: f.telephone, sameAs: lines(f.sameAs) });
    case "LocalBusiness":
      return clean({
        ...base, name: f.name, url: f.url, image: f.image, telephone: f.telephone, priceRange: f.priceRange,
        address: { "@type": "PostalAddress", streetAddress: f.street, addressLocality: f.city, addressRegion: f.region, postalCode: f.postalCode, addressCountry: f.country },
        openingHours: lines(f.openingHours),
      });
    case "Article":
      return clean({ ...base, headline: f.headline, description: f.description, image: lines(f.image), datePublished: f.datePublished, dateModified: f.dateModified,
        author: { "@type": "Person", name: f.author, url: f.authorUrl }, publisher: { "@type": "Organization", name: f.publisher, logo: { "@type": "ImageObject", url: f.publisherLogo } } });
    case "Product":
      return clean({ ...base, name: f.name, description: f.description, image: lines(f.image), sku: f.sku, brand: { "@type": "Brand", name: f.brand },
        offers: { "@type": "Offer", price: f.price, priceCurrency: f.currency, availability: f.availability ? `https://schema.org/${f.availability}` : "", url: f.url } });
    case "FAQPage":
      return clean({ ...base, mainEntity: faqs.filter((x) => x.q.trim() && x.a.trim()).map((x) => ({ "@type": "Question", name: x.q.trim(), acceptedAnswer: { "@type": "Answer", text: x.a.trim() } })) });
    case "Event":
      return clean({ ...base, name: f.name, description: f.description, startDate: f.startDate, endDate: f.endDate, image: lines(f.image),
        eventAttendanceMode: f.online === "yes" ? "https://schema.org/OnlineEventAttendanceMode" : "https://schema.org/OfflineEventAttendanceMode",
        location: f.online === "yes" ? { "@type": "VirtualLocation", url: f.locationUrl } : { "@type": "Place", name: f.venue, address: f.address },
        organizer: { "@type": "Organization", name: f.organizer } });
    case "Person":
      return clean({ ...base, name: f.name, jobTitle: f.jobTitle, url: f.url, image: f.image, worksFor: { "@type": "Organization", name: f.worksFor }, sameAs: lines(f.sameAs) });
  }
}

export const jsonLdScript = (obj: Record<string, unknown>) => `<script type="application/ld+json">\n${JSON.stringify(obj, null, 2).replace(/</g, "\\u003c")}\n</script>`;

// ── Open Graph extraction from pasted HTML ──────────────────────────────────

export interface SocialMeta {
  title: string;
  description: string;
  image: string;
  url: string;
  siteName: string;
  twitterCard: string;
  warnings: string[];
}

function decodeEntities(s: string) {
  return s.replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

/** Read Open Graph / Twitter / basic meta tags from HTML source (no network). */
export function parseSocialMeta(html: string): SocialMeta {
  const metas: Record<string, string> = {};
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attr = (n: string) => new RegExp(`\\b${n}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
    const key = attr("property") || attr("name");
    const content = attr("content");
    if (key && content) {
      const k = (key[2] ?? key[3] ?? key[4] ?? "").toLowerCase();
      if (!(k in metas)) metas[k] = decodeEntities(content[2] ?? content[3] ?? content[4] ?? "");
    }
  }
  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() ?? "";
  const m: SocialMeta = {
    title: metas["og:title"] || metas["twitter:title"] || decodeEntities(titleTag),
    description: metas["og:description"] || metas["twitter:description"] || metas["description"] || "",
    image: metas["og:image"] || metas["og:image:url"] || metas["twitter:image"] || "",
    url: metas["og:url"] || "",
    siteName: metas["og:site_name"] || "",
    twitterCard: metas["twitter:card"] || "",
    warnings: [],
  };
  if (!metas["og:title"]) m.warnings.push("Missing og:title, so platforms will fall back to the <title> tag.");
  if (!metas["og:description"]) m.warnings.push("Missing og:description.");
  if (!m.image) m.warnings.push("Missing og:image: links will be shared without a picture.");
  else if (!/^https:\/\//i.test(m.image)) m.warnings.push("og:image should be an absolute https:// URL.");
  if (!metas["og:url"]) m.warnings.push("Missing og:url.");
  if (!metas["twitter:card"]) m.warnings.push("Missing twitter:card: X will use a small summary card.");
  return m;
}

// ── Keyword ideas (pattern-based, no search-volume data) ────────────────────

const QUESTIONS = ["how to", "what is", "why", "can you", "is", "where to", "when to", "which"];
const MODIFIERS = ["best", "free", "online", "cheap", "top", "easy", "fast", "professional"];
const SUFFIXES = ["for beginners", "for free", "online", "app", "tool", "guide", "tutorial", "examples", "alternatives", "vs", "review", "near me", "2026"];
const PREPOSITIONS = ["for", "with", "without", "to", "like", "near"];

export interface KeywordIdeas {
  questions: string[];
  modifiers: string[];
  longTail: string[];
  prepositions: string[];
}

export function keywordIdeas(seed: string): KeywordIdeas {
  const k = seed.trim().toLowerCase().replace(/\s+/g, " ");
  if (!k) return { questions: [], modifiers: [], longTail: [], prepositions: [] };
  return {
    questions: QUESTIONS.map((q) => `${q} ${k}`),
    modifiers: MODIFIERS.map((m) => `${m} ${k}`),
    longTail: SUFFIXES.map((s) => `${k} ${s}`),
    prepositions: PREPOSITIONS.map((p) => `${k} ${p}`),
  };
}

// ── SEO title ideas ─────────────────────────────────────────────────────────

const titleCase = (s: string) => s.replace(/\b([a-z])/g, (m) => m.toUpperCase());

export function titleIdeas(keyword: string, brand = "", year = new Date().getFullYear()): string[] {
  const k = titleCase(keyword.trim().replace(/\s+/g, " "));
  if (!k) return [];
  const b = brand.trim();
  const withBrand = (t: string) => (b ? `${t} | ${b}` : t);
  return [
    `${k}: The Complete Guide (${year})`,
    `How to ${k} in 5 Simple Steps`,
    `${k} – Free, Fast and Easy`,
    `10 Best ${k} Tips for Beginners`,
    `What Is ${k}? Everything You Need to Know`,
    `${k} Explained: Examples and Best Practices`,
    `${k} vs Alternatives: Which Is Right for You?`,
    `The Ultimate ${k} Checklist for ${year}`,
  ].map(withBrand);
}

export { escapeHtml };
