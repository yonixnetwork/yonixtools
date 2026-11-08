import { AdSlot } from "@/components/AdSlot";
import { MonetagZones } from "@/components/MonetagZones";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { CategoryId } from "@/lib/registry";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { ToolCard } from "@/components/ToolCard";
import { categories, getCategoryBySlug, toolsInCategory } from "@/lib/registry";
import { breadcrumbLd } from "@/lib/seo";
import { absoluteUrl, categoryPath, site, toolPath } from "@/lib/site";

export const dynamicParams = false;
export const generateStaticParams = () => categories.map((c) => ({ slug: c.slug }));

type Props = { params: Promise<{ slug: string }> };

// Typed by category id: a new category without a title is a build error (video/converters/utilities/pdf once shipped without one).
const TITLES: Record<CategoryId, string> = {
  social: "Social Media Downloaders – Instagram, TikTok, Facebook",
  qr: "Free QR Code Generators – Links, Wi-Fi & Contacts",
  image: "Free Image Tools – Compress, Resize & Convert",
  seo: "Free SEO Tools – Meta Tags, Robots.txt & SERP Preview",
  developer: "Free Developer Tools – JSON, Base64, JWT & Regex",
  text: "Free Text Tools – Word Counter, Case Converter & More",
  calculators: "Free Online Calculators – Percent, Loan, BMI & Age",
  pdf: "Free PDF Tools – Merge, Split, Compress & Convert",
  video: "Free Video Tools – Frames, Audio Extraction & Video Info",
  converters: "Free Converters – Units, Colours, Timestamps & Time Zones",
  utilities: "Free Online Utilities – Random Numbers, Stopwatch & Timer",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = getCategoryBySlug((await params).slug);
  if (!c) return {};
  const list = toolsInCategory(c.id);
  const description = `${c.description} ${list.length} free tools: ${list.slice(0, 4).map((t) => t.name).join(", ")} and more.`.slice(0, 160);
  return { title: { absolute: TITLES[c.id] }, description, alternates: { canonical: categoryPath(c.slug) }, openGraph: { title: TITLES[c.id], description, url: categoryPath(c.slug), siteName: site.name } };
}

export default async function CategoryPage({ params }: Props) {
  const c = getCategoryBySlug((await params).slug);
  if (!c) notFound();
  const list = toolsInCategory(c.id);
  const crumbs = [
    { name: "Home", path: "/" },
    { name: c.name, path: categoryPath(c.slug) },
  ];
  return (
    <div className="container">
      <JsonLd data={breadcrumbLd(crumbs)} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: c.name,
          description: c.description,
          url: absoluteUrl(categoryPath(c.slug)),
          mainEntity: { "@type": "ItemList", itemListElement: list.map((t, i) => ({ "@type": "ListItem", position: i + 1, url: absoluteUrl(toolPath(t.slug)), name: t.name })) },
        }}
      />
      <Breadcrumbs items={crumbs.map((x) => ({ name: x.name, href: x.path }))} />
      <header className="tool-hero" style={{ display: "block" }}>
        <h1>{c.name}</h1>
        <p>{c.description}</p>
      </header>
      <div className="tool-grid">
        {list.map((t) => <ToolCard key={t.slug} tool={t} headingLevel={2} />)}
      </div>
      <AdSlot unit="native" className="ad-native" />
      <MonetagZones page={{ kind: "category", id: c.id }} />
      <section className="section" aria-labelledby="other-h" style={{ paddingBottom: 0 }}>
        <h2 id="other-h" style={{ fontSize: "1.1rem", marginBottom: 12 }}>
          Other categories
        </h2>
        <div className="row" style={{ gap: 6 }}>
          {categories
            .filter((x) => x.id !== c.id)
            .map((x) => (
              <a key={x.id} href={categoryPath(x.slug)} className="chip">
                {x.name}
              </a>
            ))}
        </div>
      </section>
    </div>
  );
}
