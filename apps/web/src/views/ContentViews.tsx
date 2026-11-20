import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { FaqList } from "@/components/Faq";
import { JsonLd } from "@/components/JsonLd";
import { RichText } from "@/components/RichText";
import { ToolCard } from "@/components/ToolCard";
import { getGuide, guides } from "@/lib/guides";
import { PLATFORMS } from "@/lib/downloader/detect";
import { PLATFORM_STATUS, platformStatusText } from "@/lib/downloader/platform-status";
import { getTool, isIndexable } from "@/lib/registry";
import { articleLd, breadcrumbLd, faqLd, pageMetadata } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";
import { MONETAG_ENABLED } from "@/lib/ads/monetag";
import { ADS_POLICY_OK } from "@/lib/ads/policy";
import { formatDate } from "@/i18n/format";
import { getLocale } from "@/i18n/locales";
import { localizeHref } from "@/i18n/routes";
import { getT, loadNamespace } from "@/i18n/server";
import { localizeGuide } from "@/i18n/source";
import { ViewFrame, viewContext } from "./shared";

const fmt = (locale: string, d: string) => formatDate(locale === "en" ? "en-GB" : getLocale(locale).code, d);

// ── Guides index ──

export function guidesMetadata(locale: string): Metadata {
  const t = getT(locale, "pages");
  return pageMetadata({ title: t("guides.metaTitle"), description: t("guides.metaDescription"), page: { kind: "guides" }, locale });
}

export function GuidesView({ locale }: { locale: string }) {
  const v = viewContext(locale);
  const { t } = v;
  const gm = loadNamespace(locale, "guides");
  const list = guides.map((g) => localizeGuide(g, gm));
  const page = { kind: "guides" } as const;
  const crumbs = [
    { name: t("crumb.home"), path: v.path({ kind: "home" }) },
    { name: t("guides.crumb"), path: v.path(page) },
  ];
  return (
    <ViewFrame locale={locale} page={page}>
      <div className="container">
        <JsonLd data={breadcrumbLd(crumbs)} />
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: t("guides.collectionName"),
            inLanguage: getLocale(locale).code,
            url: absoluteUrl(v.path(page)),
            mainEntity: { "@type": "ItemList", itemListElement: list.map((g, i) => ({ "@type": "ListItem", position: i + 1, url: absoluteUrl(v.path({ kind: "guide", slug: g.slug })), name: g.h1 })) },
          }}
        />
        <Breadcrumbs label={t("crumb.label")} items={crumbs.map((c) => ({ name: c.name, href: c.path }))} />
        <header className="tool-hero" style={{ display: "block" }}>
          <h1>{t("guides.h1")}</h1>
          <p>{t("guides.intro")}</p>
        </header>
        <ul className="guide-list" role="list">
          {list.map((g) => (
            <li key={g.slug} className="card guide-card">
              <h2>
                <a href={v.path({ kind: "guide", slug: g.slug })}>{g.h1}</a>
              </h2>
              <p>{g.description}</p>
              <p className="muted guide-date">{t("guides.updated", { date: fmt(locale, g.updated) })}</p>
            </li>
          ))}
        </ul>
      </div>
    </ViewFrame>
  );
}

// ── Guide ──

export function guideMetadata(locale: string, slug: string): Metadata {
  const g = localizeGuide(getGuide(slug)!, loadNamespace(locale, "guides"));
  return pageMetadata({ title: g.title, description: g.description, page: { kind: "guide", slug }, locale, type: "article", publishedTime: g.published, modifiedTime: g.updated });
}

export function GuideView({ locale, slug }: { locale: string; slug: string }) {
  const v = viewContext(locale);
  const { t } = v;
  const g = localizeGuide(getGuide(slug)!, loadNamespace(locale, "guides"));
  const page = { kind: "guide", slug } as const;
  const path = v.path(page);
  const crumbs = [
    { name: t("crumb.home"), path: v.path({ kind: "home" }) },
    { name: t("guides.crumb"), path: v.path({ kind: "guides" }) },
    { name: g.h1, path },
  ];
  const tools = g.tools.map((s) => getTool(s)).filter((x) => x && isIndexable(x)).map((x) => v.card(x!));
  const href = (h: string) => localizeHref(locale, h);
  const dated = g.reviewBy ? "guide.reviewed" : "guide.updated";
  return (
    <ViewFrame locale={locale} page={page}>
      <div className="container">
        <JsonLd data={breadcrumbLd(crumbs)} />
        <JsonLd data={articleLd({ ...g, path }, locale)} />
        <Breadcrumbs label={t("crumb.label")} items={crumbs.map((c) => ({ name: c.name, href: c.path }))} />
        <article className="prose guide">
          <header>
            <h1>{g.h1}</h1>
            <p className="muted guide-date">
              {t(dated, { date: fmt(locale, g.updated) })}
              {g.updated !== g.published ? t("guide.firstPublished", { date: fmt(locale, g.published) }) : ""}
            </p>
            <p className="lead">{g.intro}</p>
          </header>
          {g.sections.map((s) => (
            <section key={s.heading}>
              <h2>{s.heading}</h2>
              {s.paragraphs?.map((p) => (
                <p key={p}>
                  <RichText text={p} href={href} />
                </p>
              ))}
              {s.steps && (
                <ol>
                  {s.steps.map((p) => (
                    <li key={p}>
                      <RichText text={p} href={href} />
                    </li>
                  ))}
                </ol>
              )}
              {s.bullets && (
                <ul>
                  {s.bullets.map((p) => (
                    <li key={p}>
                      <RichText text={p} href={href} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </article>
        {tools.length > 0 && (
          <section className="section" aria-labelledby="guide-tools-h">
            <h2 id="guide-tools-h">{t("guide.toolsH")}</h2>
            <div className="tool-grid">
              {tools.map((x) => (
                <ToolCard key={x.slug} tool={x} headingLevel={3} />
              ))}
            </div>
          </section>
        )}
        <p className="section" style={{ paddingTop: 0 }}>
          <a href={v.path({ kind: "guides" })} className="link">
            {t("guide.more")}
          </a>
        </p>
      </div>
    </ViewFrame>
  );
}

// ── Help & About ──

const HELP_FAQ_COUNT = 8;

export function aboutMetadata(locale: string): Metadata {
  const t = getT(locale, "pages");
  return pageMetadata({ title: t("about.metaTitle"), description: t("about.metaDescription"), page: { kind: "about" }, locale });
}

export function AboutView({ locale }: { locale: string }) {
  const v = viewContext(locale);
  const { t } = v;
  const td = getT(locale, "downloader");
  const faq = Array.from({ length: HELP_FAQ_COUNT }, (_, i) => ({ q: t(`about.faq.${i}.q`), a: t(`about.faq.${i}.a`) }));
  const b = (c: React.ReactNode) => <b>{c}</b>;
  const strong = (c: React.ReactNode) => <strong>{c}</strong>;
  return (
    <ViewFrame locale={locale} page={{ kind: "about" }}>
      <div className="container" style={{ maxWidth: 860 }}>
        <JsonLd data={faqLd(faq, locale)} />
        <Breadcrumbs label={t("crumb.label")} items={[{ name: t("crumb.home"), href: v.path({ kind: "home" }) }, { name: t("about.crumb") }]} />
        <article className="prose" style={{ padding: "20px 0" }}>
          <h1 style={{ fontSize: "2rem", marginBottom: 12 }}>{t("about.h1")}</h1>
          <p>{t("about.intro")}</p>
          <section>
            <h2>{t("about.statusH")}</h2>
            <p>{t("about.statusP")}</p>
            <ul>
              {PLATFORM_STATUS.map((p) => {
                const s = platformStatusText(td, p);
                return (
                  <li key={p.id}>
                    {t.rich("about.statusItem", { strong }, { platform: PLATFORMS[p.id].name, state: s.state, content: s.content, note: s.note })}
                  </li>
                );
              })}
            </ul>
          </section>
          <section>
            <h2>{t("about.questionsH")}</h2>
            <FaqList faqs={faq} />
          </section>
          <section>
            <h2>{t("about.installH")}</h2>
            <ul>
              {["android", "desktop", "ios", "other"].map((k) => (
                <li key={k}>{t.rich(`about.install.${k}`, { strong, b })}</li>
              ))}
            </ul>
            <p>{t("about.installNote")}</p>
          </section>
          <section>
            <h2>{t("about.privacyH")}</h2>
            <p>{t.rich("about.privacyP", { link: (c) => <a href={v.path({ kind: "privacy" })}>{c}</a> })}</p>
          </section>
        </article>
      </div>
    </ViewFrame>
  );
}

// ── Privacy ──

export function privacyMetadata(locale: string): Metadata {
  const t = getT(locale, "pages");
  return pageMetadata({ title: t("privacy.metaTitle"), description: t("privacy.metaDescription"), page: { kind: "privacy" }, locale });
}

export function PrivacyView({ locale }: { locale: string }) {
  const v = viewContext(locale);
  const { t } = v;
  const strong = (c: React.ReactNode) => <strong>{c}</strong>;
  const ext = (href: string) => (c: React.ReactNode) => (
    <a href={href} rel="noopener noreferrer" target="_blank">
      {c}
    </a>
  );
  return (
    <ViewFrame locale={locale} page={{ kind: "privacy" }}>
      <div className="container" style={{ maxWidth: 760 }}>
        <Breadcrumbs label={t("crumb.label")} items={[{ name: t("crumb.home"), href: v.path({ kind: "home" }) }, { name: t("privacy.crumb") }]} />
        <article className="prose" style={{ padding: "20px 0" }}>
          <h1 style={{ fontSize: "2rem", marginBottom: 16 }}>{t("privacy.h1")}</h1>
          <section>
            <h2>{t("privacy.browserH")}</h2>
            <p>{t("privacy.browserP")}</p>
          </section>
          <section>
            <h2>{t("privacy.storedH")}</h2>
            <p>{t("privacy.storedP")}</p>
          </section>
          <section>
            <h2>{t("privacy.adsH")}</h2>
            {!ADS_POLICY_OK && <p>{t.rich("privacy.adsSuppressed", { strong })}</p>}
            <p>{t.rich("privacy.adsP1", { strong, link: ext("https://adsterra.com/privacy-policy/") })}</p>
            {MONETAG_ENABLED && <p>{t.rich("privacy.monetagP", { strong, link: ext("https://monetag.com/privacy-policy/") })}</p>}
            <p>{t("privacy.adsP2")}</p>
            <p>{t("privacy.adsP3")}</p>
            <p>{t.rich("privacy.geoP", { link: ext("https://db-ip.com") })}</p>
          </section>
          <section>
            <h2>{t("privacy.languageH")}</h2>
            <p>{t("privacy.languageP")}</p>
          </section>
          <section>
            <h2>{t("privacy.appH")}</h2>
            <p>{t("privacy.appP")}</p>
          </section>
          <section>
            <h2>{t("privacy.downloaderH")}</h2>
            <p>{t("privacy.downloaderP1")}</p>
            <p>{t("privacy.downloaderP2")}</p>
          </section>
        </article>
      </div>
    </ViewFrame>
  );
}

// ── Offline (never indexed) ──

export function offlineMetadata(locale: string): Metadata {
  const t = getT(locale, "pages");
  const m = pageMetadata({ title: t("offline.title"), description: t("offline.title"), page: { kind: "offline" }, locale, noindex: true, absoluteTitle: false });
  return { ...m, robots: { index: false, follow: false } };
}

export function OfflineView({ locale }: { locale: string }) {
  const v = viewContext(locale);
  const { t } = v;
  return (
    <ViewFrame locale={locale} page={{ kind: "offline" }}>
      <div className="container" style={{ maxWidth: 640, padding: "56px 16px", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.8rem" }}>{t("offline.h1")}</h1>
        <p className="muted" style={{ marginTop: 12 }}>
          {t("offline.p")}
        </p>
        <p style={{ marginTop: 20 }}>
          <a className="btn btn-primary" href={v.path({ kind: "home" })}>
            {t("offline.retry")}
          </a>
        </p>
      </div>
    </ViewFrame>
  );
}
