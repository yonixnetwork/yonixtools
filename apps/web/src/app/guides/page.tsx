import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { guidePath, guides } from "@/lib/guides";
import { breadcrumbLd, pageMetadata } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Guides: PDF, Image, Video & Download How-Tos | YoniXTools",
  description: "Step-by-step guides for everyday tasks: merge PDFs, compress images, work with video files and save public social media posts when you're allowed to.",
  path: "/guides/",
});

const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export default function GuidesPage() {
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Guides", path: "/guides/" },
  ];
  return (
    <div className="container">
      <JsonLd data={breadcrumbLd(crumbs)} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "YoniXTools guides",
          url: absoluteUrl("/guides/"),
          mainEntity: { "@type": "ItemList", itemListElement: guides.map((g, i) => ({ "@type": "ListItem", position: i + 1, url: absoluteUrl(guidePath(g.slug)), name: g.h1 })) },
        }}
      />
      <Breadcrumbs items={crumbs.map((c) => ({ name: c.name, href: c.path }))} />
      <header className="tool-hero" style={{ display: "block" }}>
        <h1>Guides</h1>
        <p>Short, practical how-tos for the tasks people use YoniXTools for. Each guide links to the tool that does the job.</p>
      </header>
      <ul className="guide-list" role="list">
        {guides.map((g) => (
          <li key={g.slug} className="card guide-card">
            <h2>
              <a href={guidePath(g.slug)}>{g.h1}</a>
            </h2>
            <p>{g.description}</p>
            <p className="muted guide-date">Updated {fmt(g.updated)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
