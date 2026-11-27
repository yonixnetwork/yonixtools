import { ArrowRight, CircleAlert, CircleCheck, CircleMinus, Gauge, Link as LinkIcon, ShieldCheck, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { AdPlacement } from "@/components/AdPlacement";
import { Downloader } from "@/components/Downloader";
import { FaqList } from "@/components/Faq";
import { Icon, PlatformIcon } from "@/components/Icon";
import { JsonLd } from "@/components/JsonLd";
import { Recommended } from "@/components/Recommended";
import { ToolCard } from "@/components/ToolCard";
import { guides } from "@/lib/guides";
import { PLATFORMS } from "@/lib/downloader/detect";
import { PLATFORM_STATUS, platformStatusText } from "@/lib/downloader/platform-status";
import { categories, editorsPicks, getTool, popularSlugs, recentlyAdded, tools, toolsInCategory } from "@/lib/registry";
import { faqLd, organizationLd, pageMetadata, websiteLd } from "@/lib/seo";
import { site } from "@/lib/site";
import { getT, loadNamespace } from "@/i18n/server";
import { localizeCategory, localizeGuide } from "@/i18n/source";
import { ViewFrame, viewContext } from "./shared";

const PAGE = { kind: "home" } as const;

export function homeMetadata(locale: string): Metadata {
  const t = getT(locale, "pages");
  return pageMetadata({ title: locale === "en" ? `Free Online Tools & Social Media Downloader | ${site.name}` : t("home.metaTitle"), description: locale === "en" ? site.description : t("home.metaDescription"), page: PAGE, locale });
}

const FAQ_COUNT = 6;
const WHY = [
  { icon: <LinkIcon aria-hidden />, id: "link" },
  { icon: <ShieldCheck aria-hidden />, id: "private" },
  { icon: <Gauge aria-hidden />, id: "fast" },
  { icon: <Sparkles aria-hidden />, id: "free" },
];

export function HomeView({ locale }: { locale: string }) {
  const v = viewContext(locale);
  const { t } = v;
  const td = getT(locale, "downloader");
  const reg = loadNamespace(locale, "registry");
  const gm = loadNamespace(locale, "guides");
  const faq = Array.from({ length: FAQ_COUNT }, (_, i) => ({ q: t(`home.faq.${i}.q`), a: t(`home.faq.${i}.a`) }));
  const popular = popularSlugs.map((s) => v.card(getTool(s)!));
  const recent = recentlyAdded(4).map(v.card);
  const working = PLATFORM_STATUS.filter((p) => p.state === "working").slice(0, 6);
  return (
    <ViewFrame locale={locale} page={PAGE} namespaces={["downloader", "errors"]}>
      <JsonLd data={organizationLd()} />
      <JsonLd data={websiteLd(locale)} />
      <JsonLd data={faqLd(faq, locale)} />

      <section className="hero hero-compact">
        <div className="container">
          <h1>{t("home.h1")}</h1>
          <p className="lede">{t("home.lede")}</p>
          <Downloader />
          <div className="platform-row" aria-label={t("home.workingPlatforms")}>
            {working.map((p) => (
              <span key={p.id} className="platform-pill">
                <PlatformIcon platform={p.id} />
                {PLATFORMS[p.id].name.replace(" (Twitter)", "")}
              </span>
            ))}
            <a href="#platforms-h" className="platform-pill platform-more">
              {t("home.allPlatforms")}
            </a>
          </div>
          <nav className="quick-tools" aria-label={t("home.popularNav")}>
            <span className="muted">{t("home.popularLabel")}</span>
            {popular.slice(0, 6).map((c) => (
              <a key={c.slug} href={c.href}>
                {c.name}
              </a>
            ))}
            <a href={v.path({ kind: "tools" })} className="quick-all">
              {t("home.allTools")} <ArrowRight aria-hidden />
            </a>
          </nav>
        </div>
      </section>

      <div className="container">
        <AdPlacement page="home" position="after-hero" />
      </div>

      <section className="section" aria-labelledby="platforms-h">
        <div className="container">
          <div className="section-head">
            <div>
              <h2 id="platforms-h">{t("home.platformsH")}</h2>
              <p>{t("home.platformsP")}</p>
            </div>
          </div>
          <ul className="platform-status" role="list">
            {PLATFORM_STATUS.map((p) => {
              const s = platformStatusText(td, p);
              return (
                <li key={p.id} className={`ps-${p.state}`} data-platform={p.id}>
                  <span className="ps-icon">
                    <PlatformIcon platform={p.id} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <h3>
                      {PLATFORMS[p.id].name}{" "}
                      <span className={`badge ${p.state === "working" ? "badge-live" : p.state === "limited" ? "badge-pending" : "badge-blocked"}`}>
                        {p.state === "working" ? <CircleCheck aria-hidden /> : p.state === "limited" ? <CircleMinus aria-hidden /> : <CircleAlert aria-hidden />}
                        {s.state}
                      </span>
                    </h3>
                    <p className="ps-content">{s.content}</p>
                    <p className="muted ps-note">{s.note}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="section" aria-labelledby="popular-h">
        <div className="container">
          <div className="section-head">
            <div>
              <h2 id="popular-h">{t("home.popularH")}</h2>
              <p>{t("home.popularP")}</p>
            </div>
            <a className="link-more" href={v.path({ kind: "tools" })}>
              {t("home.allTools")} <ArrowRight aria-hidden />
            </a>
          </div>
          <div className="tool-grid cols-4">
            {popular.map((c) => (
              <ToolCard key={c.slug} tool={c} />
            ))}
          </div>
        </div>
      </section>

      <div className="container">
        <AdPlacement page="home" position="mid-content" />
      </div>

      <section className="section" aria-labelledby="cat-h">
        <div className="container">
          <div className="section-head">
            <div>
              <h2 id="cat-h">{t("home.categoriesH")}</h2>
              <p>{t("home.categoriesP")}</p>
            </div>
          </div>
          <div className="cat-grid">
            {categories.map((c0) => {
              const c = localizeCategory(c0, reg);
              return (
                <a key={c.id} href={v.path({ kind: "category", id: c.id })} className="cat-tile">
                  <span className="tool-icon">
                    <Icon name={c.icon} />
                  </span>
                  <h3>{c.name}</h3>
                  <p>{c.description}</p>
                  <span className="count">{t("home.toolCount", { count: toolsInCategory(c.id).length })}</span>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="new-h">
        <div className="container">
          <div className="section-head">
            <div>
              <h2 id="new-h">{t("home.recentH")}</h2>
              <p>{t("home.recentP")}</p>
            </div>
          </div>
          <div className="tool-grid cols-4">
            {recent.map((c) => (
              <ToolCard key={c.slug} tool={c} />
            ))}
          </div>
        </div>
      </section>

      <Recommended cards={tools.map(v.card)} picks={editorsPicks} />

      <div className="container">
        <AdPlacement page="home" position="lower-native" />
      </div>

      <section className="section" aria-labelledby="why-h">
        <div className="container">
          <div className="section-head">
            <div>
              <h2 id="why-h">{t("home.whyH")}</h2>
            </div>
          </div>
          <div className="why-grid">
            {WHY.map((w) => (
              <div key={w.id} className="why-item">
                <span className="tool-icon">{w.icon}</span>
                <h3>{t(`home.why.${w.id}.title`)}</h3>
                <p>{t(`home.why.${w.id}.text`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="guides-h">
        <div className="container">
          <div className="section-head">
            <div>
              <h2 id="guides-h">{t("home.guidesH")}</h2>
              <p>{t("home.guidesP")}</p>
            </div>
            <a className="link-more" href={v.path({ kind: "guides" })}>
              {t("home.allGuides")} <ArrowRight aria-hidden />
            </a>
          </div>
          <ul className="guide-list" role="list">
            {guides.slice(0, 4).map((g0) => {
              const g = localizeGuide(g0, gm);
              return (
                <li key={g.slug} className="card guide-card">
                  <h3>
                    <a href={v.path({ kind: "guide", slug: g.slug })}>{g.h1}</a>
                  </h3>
                  <p>{g.description}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="section" aria-labelledby="faq-h">
        <div className="container" style={{ maxWidth: 820 }}>
          <div className="section-head">
            <h2 id="faq-h">{t("home.faqH")}</h2>
          </div>
          <FaqList faqs={faq} />
        </div>
      </section>
    </ViewFrame>
  );
}
