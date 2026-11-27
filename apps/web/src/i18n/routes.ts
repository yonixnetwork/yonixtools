/**
 * Every public page of the site as a PageRef, and its URL in each locale.
 *
 * English keeps its existing root URLs (unchanged SEO). Other locales live under /<prefix>/ with
 * translated slugs from the catalogue (Latin-script locales) or the English slugs (other scripts):
 *   en     /pdf-merger/            /category/pdf-tools/            /guides/how-to-merge-pdf-files/
 *   es     /es/unir-pdf/           /es/categoria/herramientas-pdf/ /es/guias/como-unir-pdf/
 *   ja     /ja/pdf-merger/         /ja/category/pdf-tools/         /ja/guides/how-to-merge-pdf-files/
 */
import { allTools, categories, isIndexable as toolIndexable, type CategoryId } from "@/lib/registry";
import { guides } from "@/lib/guides";
import { allReviewed, builtLocales, type KeyMatcher } from "./catalogue";
import { getLocale } from "./locales";
import { loadNamespace } from "./server";
import { TOOL_NAMESPACE } from "./namespaces";

export type PageRef =
  | { kind: "home" }
  | { kind: "tools" }
  | { kind: "category"; id: CategoryId }
  | { kind: "tool"; slug: string }
  | { kind: "guides" }
  | { kind: "guide"; slug: string }
  | { kind: "about" }
  | { kind: "privacy" }
  | { kind: "offline" };

export const pageId = (p: PageRef): string => ("id" in p ? `${p.kind}:${p.id}` : "slug" in p ? `${p.kind}:${p.slug}` : p.kind);

/** Every page, in sitemap order. */
export function allPages(): PageRef[] {
  return [
    { kind: "home" },
    { kind: "tools" },
    ...categories.map((c) => ({ kind: "category" as const, id: c.id })),
    ...allTools.map((t) => ({ kind: "tool" as const, slug: t.slug })),
    { kind: "guides" },
    ...guides.map((g) => ({ kind: "guide" as const, slug: g.slug })),
    { kind: "about" },
    { kind: "privacy" },
    { kind: "offline" },
  ];
}

const ROUTE_DEFAULTS = { tools: "tools", category: "category", guides: "guides", about: "about", privacy: "privacy", offline: "offline" } as const;
type RouteKey = keyof typeof ROUTE_DEFAULTS;

function seg(locale: string, key: RouteKey): string {
  if (locale === "en") return ROUTE_DEFAULTS[key];
  const v = loadNamespace(locale, "common")[`route.${key}`];
  return typeof v === "string" && v ? v : ROUTE_DEFAULTS[key];
}
function slugOf(locale: string, ns: "registry" | "guides", key: string, fallback: string): string {
  if (locale === "en") return fallback;
  const v = loadNamespace(locale, ns)[key];
  return typeof v === "string" && v ? v : fallback;
}

/** The path of a page in a locale (always with leading and trailing slash). */
export function pathFor(locale: string, p: PageRef): string {
  const pre = locale === "en" ? "" : `/${getLocale(locale).prefix}`;
  const cat = (id: string) => slugOf(locale, "registry", `category.${id}.slug`, categories.find((c) => c.id === id)!.slug);
  switch (p.kind) {
    case "home":
      return `${pre}/`;
    case "tools":
    case "guides":
    case "about":
    case "privacy":
    case "offline":
      return `${pre}/${seg(locale, p.kind)}/`;
    case "category":
      return `${pre}/${seg(locale, "category")}/${cat(p.id)}/`;
    case "tool":
      return `${pre}/${slugOf(locale, "registry", `tool.${p.slug}.slug`, p.slug)}/`;
    case "guide":
      return `${pre}/${seg(locale, "guides")}/${slugOf(locale, "guides", `guide.${p.slug}.slug`, p.slug)}/`;
  }
}

const tableCache = new Map<string, Map<string, PageRef>>();
/** path → page for one locale. */
export function routeTable(locale: string): Map<string, PageRef> {
  let t = tableCache.get(locale);
  if (!t) {
    t = new Map(allPages().map((p) => [pathFor(locale, p), p]));
    tableCache.set(locale, t);
  }
  return t;
}

/** The page at a path in a locale, if any. */
export const resolvePath = (locale: string, path: string): PageRef | undefined => routeTable(locale).get(path.endsWith("/") ? path : `${path}/`);

/** Translate an English internal path ("/pdf-merger/", "/guides/x/", "/#faq") to a locale's path. */
export function localizeHref(locale: string, href: string): string {
  if (locale === "en" || !href.startsWith("/")) return href;
  const [p, hash = ""] = href.split("#");
  const [pathOnly, query = ""] = p.split("?");
  const page = resolvePath("en", pathOnly || "/");
  if (!page) return href;
  return `${pathFor(locale, page)}${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`;
}

// ── Indexing eligibility ──

/** The catalogue keys a page shows: every one must be reviewed before the page may be indexed. */
export function pageKeys(p: PageRef): KeyMatcher[] {
  const chrome: KeyMatcher[] = [{ ns: "common" }, { ns: "registry", re: /^(category\.[^.]+\.(name|slug)|tool\.[^.]+\.(name|slug))$/ }];
  switch (p.kind) {
    case "home":
      return [...chrome, { ns: "pages", prefix: "home." }, { ns: "registry", re: /^(category\.[^.]+\.description|tool\.[^.]+\.tagline)$/ }, { ns: "downloader" }, { ns: "errors" }, { ns: "guides", re: /^guide\.[^.]+\.(h1|description|slug)$/ }];
    case "tools":
      return [...chrome, { ns: "pages", prefix: "tools." }, { ns: "registry", re: /^tool\.[^.]+\.tagline$/ }];
    case "category":
      return [...chrome, { ns: "pages", prefix: "category." }, { ns: "pages", prefix: `categories.${p.id}.` }, { ns: "registry", prefix: `category.${p.id}.` }, { ns: "registry", re: /^tool\.[^.]+\.tagline$/ }, { ns: "guides", re: /^guide\.[^.]+\.(h1|slug)$/ }];
    case "tool": {
      const t = allTools.find((x) => x.slug === p.slug)!;
      const ui = t.category === "social" ? [{ ns: "downloader" }, { ns: "errors" }] : [{ ns: "tools-ui" }, ...(TOOL_NAMESPACE[p.slug] ? [{ ns: TOOL_NAMESPACE[p.slug] }] : [])];
      return [...chrome, { ns: "pages", prefix: "tool." }, { ns: "registry", prefix: `tool.${p.slug}.` }, ...ui, { ns: "guides", re: /^guide\.[^.]+\.(h1|slug)$/ }];
    }
    case "guides":
      return [...chrome, { ns: "pages", prefix: "guides." }, { ns: "guides", re: /^guide\.[^.]+\.(h1|description|slug)$/ }];
    case "guide":
      return [...chrome, { ns: "pages", prefix: "guide." }, { ns: "guides", prefix: `guide.${p.slug}.` }, { ns: "registry", re: /^tool\.[^.]+\.tagline$/ }];
    case "about":
      return [...chrome, { ns: "pages", prefix: "about." }];
    case "privacy":
      return [...chrome, { ns: "pages", prefix: "privacy." }];
    case "offline":
      return [...chrome, { ns: "pages", prefix: "offline." }];
  }
}

/** Whether the page itself may be indexed at all (in any language). */
function pageIndexableAtAll(p: PageRef): boolean {
  if (p.kind === "offline") return false;
  if (p.kind === "tool") {
    const t = allTools.find((x) => x.slug === p.slug);
    return !!t && toolIndexable(t);
  }
  return true;
}

/**
 * A page in a locale is indexable when the page is indexable at all, the locale is built, and
 * (for translations) every key the page shows has been reviewed by a person. Machine translations
 * are never indexed.
 */
export function isIndexableIn(locale: string, p: PageRef): boolean {
  if (!pageIndexableAtAll(p)) return false;
  if (locale === "en") return true;
  if (!builtLocales().includes(locale)) return false;
  return allReviewed(locale, pageKeys(p));
}

/** Locale → path of this page, for every built locale (language selector). */
export function alternatesFor(p: PageRef): Record<string, string> {
  return Object.fromEntries(builtLocales().map((l) => [l, pathFor(l, p)]));
}

/** hreflang → path for the page's INDEXABLE versions (+ x-default = English). Empty unless ≥ 2. */
export function hreflangFor(p: PageRef): Record<string, string> {
  const versions = builtLocales().filter((l) => isIndexableIn(l, p));
  if (versions.length < 2) return {};
  const out: Record<string, string> = {};
  for (const l of versions) out[getLocale(l).code] = pathFor(l, p);
  if (versions.includes("en")) out["x-default"] = pathFor("en", p);
  return out;
}
