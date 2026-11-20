import type { Metadata } from "next";
import { AdPlacement } from "@/components/AdPlacement";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { ToolCard } from "@/components/ToolCard";
import { ToolsExplorer } from "@/components/ToolsExplorer";
import { GRID_AD_AFTER, GRID_AD_MIN } from "@/lib/ads/placements";
import { guides } from "@/lib/guides";
import { categories, getCategory, tools, toolsInCategory, type CategoryId } from "@/lib/registry";
import { breadcrumbLd, categoryDescription, pageMetadata } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";
import { getT, loadNamespace } from "@/i18n/server";
import { getLocale } from "@/i18n/locales";
import { localizeCategory, localizeGuide } from "@/i18n/source";
import { ViewFrame, viewContext } from "./shared";

// ── All tools ──

export function toolsMetadata(locale: string): Metadata {
  const t = getT(locale, "pages");
  return pageMetadata({ title: t("tools.metaTitle"), description: t("tools.metaDescription", { count: tools.length }), page: { kind: "tools" }, locale });
}

export function ToolsView({ locale }: { locale: string }) {
  const { t, path } = viewContext(locale);
  const page = { kind: "tools" } as const;
  return (
    <ViewFrame locale={locale} page={page}>
      <div className="container">
        <Breadcrumbs label={t("crumb.label")} items={[{ name: t("crumb.home"), href: path({ kind: "home" }) }, { name: t("tools.crumb") }]} />
        <header className="tool-hero" style={{ display: "block" }}>
          <h1>{t("tools.h1")}</h1>
          <p>{t("tools.intro")}</p>
        </header>
        <ToolsExplorer gridAd={<AdPlacement page="listing" position="in-grid" className="ad-grid-break" />} />
        <AdPlacement page="listing" position="after-list" monetag={{ kind: "tools" }} />
      </div>
    </ViewFrame>
  );
}

// ── Category ──

export function categoryMetadata(locale: string, id: CategoryId): Metadata {
  const v = viewContext(locale);
  const c = localizeCategory(getCategory(id), loadNamespace(locale, "registry"));
  const list = toolsInCategory(id).map(v.tool);
  return pageMetadata({ title: v.t(`categories.${id}.title`), description: categoryDescription(c.description, list.map((x) => x.name), 160, locale), page: { kind: "category", id }, locale });
}

export function CategoryView({ locale, id }: { locale: string; id: CategoryId }) {
  const v = viewContext(locale);
  const { t } = v;
  const reg = loadNamespace(locale, "registry");
  const gm = loadNamespace(locale, "guides");
  const c = localizeCategory(getCategory(id), reg);
  const page = { kind: "category", id } as const;
  const list = toolsInCategory(id).map(v.card);
  const ids = new Set(list.map((x) => x.slug));
  const catGuides = guides.filter((g) => g.tools.some((s) => ids.has(s))).map((g) => localizeGuide(g, gm));
  const crumbs = [
    { name: t("crumb.home"), path: v.path({ kind: "home" }) },
    { name: c.name, path: v.path(page) },
  ];
  return (
    <ViewFrame locale={locale} page={page}>
      <div className="container">
        <JsonLd data={breadcrumbLd(crumbs)} />
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: c.name,
            description: c.description,
            inLanguage: getLocale(locale).code,
            url: absoluteUrl(v.path(page)),
            mainEntity: { "@type": "ItemList", itemListElement: list.map((x, i) => ({ "@type": "ListItem", position: i + 1, url: absoluteUrl(x.href!), name: x.name })) },
          }}
        />
        <Breadcrumbs label={t("crumb.label")} items={crumbs.map((x) => ({ name: x.name, href: x.path }))} />
        <header className="tool-hero" style={{ display: "block" }}>
          <h1>{c.name}</h1>
          <p>{t(`categories.${id}.intro`)}</p>
        </header>
        <div className="tool-grid">
          {list.map((x, i) => [
            <ToolCard key={x.slug} tool={x} headingLevel={2} />,
            i === GRID_AD_AFTER - 1 && list.length >= GRID_AD_MIN && (
              <div key="ad" className="grid-break">
                <AdPlacement page="listing" position="in-grid" className="ad-grid-break" />
              </div>
            ),
          ])}
        </div>
        <AdPlacement page="listing" position="after-list" monetag={{ kind: "category", id: c.id }} />
        {catGuides.length > 0 && (
          <section className="section guide-links" aria-labelledby="cat-guides-h" style={{ paddingBottom: 0 }}>
            <h2 id="cat-guides-h" style={{ fontSize: "1.1rem", marginBottom: 8 }}>
              {t("category.guidesH")}
            </h2>
            <ul>
              {catGuides.map((g) => (
                <li key={g.slug}>
                  <a href={v.path({ kind: "guide", slug: g.slug })} className="link">
                    {g.h1}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section className="section" aria-labelledby="other-h" style={{ paddingBottom: 0 }}>
          <h2 id="other-h" style={{ fontSize: "1.1rem", marginBottom: 12 }}>
            {t("category.otherH")}
          </h2>
          <div className="row" style={{ gap: 6 }}>
            {categories
              .filter((x) => x.id !== id)
              .map((x) => (
                <a key={x.id} href={v.path({ kind: "category", id: x.id })} className="chip">
                  {localizeCategory(x, reg).name}
                </a>
              ))}
          </div>
        </section>
      </div>
    </ViewFrame>
  );
}
