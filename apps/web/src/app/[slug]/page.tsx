import { Clock, MonitorSmartphone, Server } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Downloader } from "@/components/Downloader";
import { PLATFORMS, unavailableMessage } from "@/lib/downloader/detect";
import { PLATFORM_STATUS, STATE_LABEL, VERIFIED_ON } from "@/lib/downloader/platform-status";
import { FaqList } from "@/components/Faq";
import { ToolIcon } from "@/components/Icon";
import { JsonLd } from "@/components/JsonLd";
import { ToolRenderer } from "@/components/tools/registry";
import { VisitRecorder } from "@/components/VisitRecorder";
import { allTools, getCategory, getTool, isAvailable, relatedTools } from "@/lib/registry";
import { breadcrumbLd, faqLd, toolBreadcrumbs, toolLd, toolMetadata } from "@/lib/seo";
import { categoryPath, toolPath } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return allTools.map((t) => ({ slug: t.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tool = getTool((await params).slug);
  return tool ? toolMetadata(tool) : {};
}

export default async function ToolPage({ params }: Props) {
  const tool = getTool((await params).slug);
  if (!tool) notFound();
  const cat = getCategory(tool.category);
  const crumbs = toolBreadcrumbs(tool);
  const related = relatedTools(tool.slug, 5);
  const isDownloader = tool.category === "social";
  const status = tool.platform ? PLATFORM_STATUS.find((p) => p.id === tool.platform) : undefined;

  return (
    <>
      <JsonLd data={toolLd(tool)} />
      <JsonLd data={breadcrumbLd(crumbs)} />
      <JsonLd data={faqLd(tool.content.faqs)} />
      <VisitRecorder slug={tool.slug} />

      <div className="container">
        <Breadcrumbs items={crumbs.map((c) => ({ name: c.name, href: c.path }))} />
        <header className="tool-hero">
          <ToolIcon tool={tool} size="lg" />
          <div>
            <h1>{tool.name}</h1>
            <p>{tool.content.intro}</p>
            <div className="row">
              {!isAvailable(tool) ? (
                <span className="badge badge-pending">
                  <Clock aria-hidden /> Link detection works · downloading launches with the backend
                </span>
              ) : tool.runsIn === "server" ? (
                <span className="badge badge-live">
                  <Server aria-hidden /> Processed on our server · files deleted after 15 minutes
                </span>
              ) : (
                <span className="badge badge-live">
                  <MonitorSmartphone aria-hidden /> Runs in your browser · nothing uploaded
                </span>
              )}
              <span className="badge badge-neutral">Free · no sign-up</span>
            </div>
          </div>
        </header>

        <section className={isDownloader ? "" : "card tool-surface"} aria-label={`${tool.name} tool`}>
          {isDownloader && unavailableMessage(tool.platform) && (
            <div className="notice notice-error" role="status" data-testid="platform-status">
              <div>
                <strong>Not available</strong>
                {unavailableMessage(tool.platform)}
              </div>
            </div>
          )}
          {isDownloader && status && status.state !== "working" && (
            <div className={`notice ${status.state === "blocked" ? "notice-error" : "notice-warn"}`} role="status" data-testid="platform-status">
              <div>
                <strong>
                  {PLATFORMS[status.id].name}: {STATE_LABEL[status.state].toLowerCase()} (checked {VERIFIED_ON})
                </strong>
                {status.note}
              </div>
            </div>
          )}
          {isDownloader ? <Downloader expectedPlatform={tool.platform} /> : <ToolRenderer slug={tool.slug} />}
        </section>

        <div className="content-grid">
          <article className="prose">
            <section aria-labelledby="how-h">
              <h2 id="how-h">How to use the {tool.name}</h2>
              <ol>
                {tool.content.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </section>
            <section aria-labelledby="feat-h">
              <h2 id="feat-h">Features</h2>
              <ul>
                {tool.content.features.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </section>
            <section aria-labelledby="faq-h">
              <h2 id="faq-h">Frequently asked questions</h2>
              <FaqList faqs={tool.content.faqs} />
            </section>
          </article>
          <aside>
            <div className="card aside-card">
              <h2>Related tools</h2>
              <nav className="related-list" aria-label="Related tools">
                {related.map((t) => (
                  <a key={t.slug} href={toolPath(t.slug)}>
                    <ToolIcon tool={t} />
                    {t.name}
                  </a>
                ))}
              </nav>
              <p style={{ marginTop: 14, fontSize: "0.9rem" }}>
                <a href={categoryPath(cat.slug)} className="link">
                  All {cat.name.toLowerCase()} →
                </a>
              </p>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
