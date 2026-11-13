import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { RichText } from "@/components/RichText";
import { ToolCard } from "@/components/ToolCard";
import { getGuide, guidePath, guides } from "@/lib/guides";
import { getTool, isIndexable } from "@/lib/registry";
import { articleLd, breadcrumbLd, pageMetadata } from "@/lib/seo";

export const dynamicParams = false;
export const generateStaticParams = () => guides.map((g) => ({ slug: g.slug }));

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const g = getGuide((await params).slug);
  if (!g) return {};
  return pageMetadata({ title: g.title, description: g.description, path: guidePath(g.slug), type: "article", publishedTime: g.published, modifiedTime: g.updated });
}

const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export default async function GuidePage({ params }: Props) {
  const g = getGuide((await params).slug);
  if (!g) notFound();
  const path = guidePath(g.slug);
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Guides", path: "/guides/" },
    { name: g.h1, path },
  ];
  const tools = g.tools.map((s) => getTool(s)).filter((t) => t && isIndexable(t));
  return (
    <div className="container">
      <JsonLd data={breadcrumbLd(crumbs)} />
      <JsonLd data={articleLd({ ...g, path })} />
      <Breadcrumbs items={crumbs.map((c) => ({ name: c.name, href: c.path }))} />
      <article className="prose guide">
        <header>
          <h1>{g.h1}</h1>
          <p className="muted guide-date">
            {g.reviewBy ? "Reviewed" : "Updated"} {fmt(g.updated)}
            {g.updated !== g.published ? ` · first published ${fmt(g.published)}` : ""}
          </p>
          <p className="lead">{g.intro}</p>
        </header>
        {g.sections.map((s) => (
          <section key={s.heading}>
            <h2>{s.heading}</h2>
            {s.paragraphs?.map((p) => (
              <p key={p}>
                <RichText text={p} />
              </p>
            ))}
            {s.steps && (
              <ol>
                {s.steps.map((p) => (
                  <li key={p}>
                    <RichText text={p} />
                  </li>
                ))}
              </ol>
            )}
            {s.bullets && (
              <ul>
                {s.bullets.map((p) => (
                  <li key={p}>
                    <RichText text={p} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </article>
      {tools.length > 0 && (
        <section className="section" aria-labelledby="guide-tools-h">
          <h2 id="guide-tools-h">Tools in this guide</h2>
          <div className="tool-grid">
            {tools.map((t) => (
              <ToolCard key={t!.slug} tool={t!} headingLevel={3} />
            ))}
          </div>
        </section>
      )}
      <p className="section" style={{ paddingTop: 0 }}>
        <a href="/guides/" className="link">
          More guides →
        </a>
      </p>
    </div>
  );
}
