import { Clock, MonitorSmartphone, Server } from "lucide-react";
import type { Metadata } from "next";
import { AdPlacement } from "@/components/AdPlacement";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Downloader } from "@/components/Downloader";
import { FaqList } from "@/components/Faq";
import { ToolIcon } from "@/components/Icon";
import { JsonLd } from "@/components/JsonLd";
import { ToolDownloadPanel } from "@/components/ToolDownloadPanel";
import { VisitRecorder } from "@/components/VisitRecorder";
import { ToolRenderer } from "@/components/tools/registry";
import { guidesForTool } from "@/lib/guides";
import { PLATFORMS, unavailableMessageKey } from "@/lib/downloader/detect";
import { PLATFORM_STATUS, platformStatusText } from "@/lib/downloader/platform-status";
import { getCategory, getTool, isAvailable, relatedTools } from "@/lib/registry";
import { breadcrumbLd, faqLd, toolBreadcrumbs, toolLd, toolMetadata } from "@/lib/seo";
import { TOOL_NAMESPACE } from "@/i18n/namespaces";
import { getT, loadNamespace } from "@/i18n/server";
import { localizeCategory, localizeGuide } from "@/i18n/source";
import { ViewFrame, viewContext } from "./shared";

export function toolPageMetadata(locale: string, slug: string): Metadata {
  return toolMetadata(viewContext(locale).toolBySlug(slug), locale);
}

export function ToolView({ locale, slug }: { locale: string; slug: string }) {
  const v = viewContext(locale);
  const { t } = v;
  const td = getT(locale, "downloader");
  const base = getTool(slug)!;
  const tool = v.tool(base);
  const cat = localizeCategory(getCategory(tool.category), loadNamespace(locale, "registry"));
  const page = { kind: "tool", slug } as const;
  const crumbs = toolBreadcrumbs(tool, locale);
  const related = relatedTools(slug, 5).map(v.card);
  const isDownloader = tool.category === "social";
  const status = tool.platform ? PLATFORM_STATUS.find((p) => p.id === tool.platform) : undefined;
  const unavailable = isDownloader ? unavailableMessageKey(tool.platform) : null;
  const ads = !tool.hidden; // no advertising on pages of unavailable platforms
  const pt = isDownloader ? "downloader" : "tool";
  const ns = isDownloader ? ["downloader", "errors"] : ["tools-ui", ...(TOOL_NAMESPACE[slug] ? [TOOL_NAMESPACE[slug]] : [])];
  const gm = loadNamespace(locale, "guides");
  const toolGuides = guidesForTool(slug).map((g) => localizeGuide(g, gm));

  return (
    <ViewFrame locale={locale} page={page} namespaces={ns}>
      <JsonLd data={toolLd(tool, locale)} />
      <JsonLd data={breadcrumbLd(crumbs)} />
      <JsonLd data={faqLd(tool.content.faqs, locale)} />
      <VisitRecorder slug={slug} />

      <div className="container">
        <Breadcrumbs label={t("crumb.label")} items={crumbs.map((c) => ({ name: c.name, href: c.path }))} />
        <header className="tool-hero">
          <ToolIcon tool={tool} size="lg" />
          <div>
            <h1>{tool.name}</h1>
            <p>{tool.content.intro}</p>
            <div className="row">
              {!isAvailable(tool) ? (
                <span className="badge badge-pending">
                  <Clock aria-hidden /> {t("tool.comingSoon")}
                </span>
              ) : tool.runsIn === "server" ? (
                <span className="badge badge-live">
                  <Server aria-hidden /> {t("tool.badgeServer")}
                </span>
              ) : (
                <span className="badge badge-live">
                  <MonitorSmartphone aria-hidden /> {t("tool.badgeBrowser")}
                </span>
              )}
              <span className="badge badge-neutral">{t("tool.badgeFree")}</span>
            </div>
          </div>
        </header>

        {/* Utility tools: one ad between the heading and the tool (never inside it). Downloaders: none above the URL box. */}
        {ads && !isDownloader && <AdPlacement page="tool" position="before-tool" />}

        <section className={isDownloader ? "" : "card tool-surface"} aria-label={t("tool.sectionAria", { name: tool.name })}>
          {unavailable && (
            <div className="notice notice-error" role="status" data-testid="platform-status">
              <div>
                <strong>{t("tool.notAvailable")}</strong>
                {td(unavailable)}
              </div>
            </div>
          )}
          {isDownloader && status && status.state !== "working" && (
            <div className={`notice ${status.state === "blocked" ? "notice-error" : "notice-warn"}`} role="status" data-testid="platform-status">
              <div>
                <strong>{t(`tool.platformState.${status.state}`, { platform: PLATFORMS[status.id].name })}</strong>
                {platformStatusText(td, status).note}
              </div>
            </div>
          )}
          {isDownloader ? <Downloader expectedPlatform={tool.platform} /> : <ToolRenderer slug={slug} />}
          {!isDownloader && <ToolDownloadPanel ad={ads ? <AdPlacement page="tool" position="download-panel" className="dl-panel-ad" /> : null} />}
        </section>

        {/* Below the tool and its results, never between its controls. */}
        {ads && <AdPlacement page={pt} position={isDownloader ? "after-result" : "after-tool"} />}

        <div className="content-grid">
          <article className="prose">
            <section aria-labelledby="how-h">
              <h2 id="how-h">{t("tool.howH", { name: tool.name })}</h2>
              <ol>
                {tool.content.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </section>
            {ads && <AdPlacement page={pt} position="content-1" monetag={{ kind: "tool", tool: base }} />}
            <section aria-labelledby="feat-h">
              <h2 id="feat-h">{t("tool.featuresH")}</h2>
              <ul>
                {tool.content.features.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </section>
            {ads && <AdPlacement page={pt} position="content-2" />}
            <section aria-labelledby="faq-h">
              <h2 id="faq-h">{t("tool.faqH")}</h2>
              <FaqList faqs={tool.content.faqs} />
            </section>
            {ads && <AdPlacement page={pt} position="after-faq" />}
          </article>
          <aside>
            <div className="card aside-card">
              <h2>{t("tool.relatedH")}</h2>
              <nav className="related-list" aria-label={t("tool.relatedH")}>
                {related.map((r) => (
                  <a key={r.slug} href={r.href}>
                    <ToolIcon tool={r} />
                    {r.name}
                  </a>
                ))}
              </nav>
              <p style={{ marginTop: 14, fontSize: "0.9rem" }}>
                <a href={v.path({ kind: "category", id: cat.id })} className="link">
                  {t("tool.allInCategory", { category: locale === "en" ? cat.name.toLowerCase() : cat.name })}
                </a>
              </p>
            </div>
            {toolGuides.length > 0 && (
              <div className="card aside-card guide-links">
                <h2>{t("tool.guidesH")}</h2>
                <ul>
                  {toolGuides.map((g) => (
                    <li key={g.slug}>
                      <a href={v.path({ kind: "guide", slug: g.slug })} className="link">
                        {g.h1}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
      </div>
    </ViewFrame>
  );
}
