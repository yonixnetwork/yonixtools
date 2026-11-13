import { AdPlacement } from "@/components/AdPlacement";
import { GRID_AD_AFTER, GRID_AD_MIN } from "@/lib/ads/placements";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { CategoryId } from "@/lib/registry";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { ToolCard } from "@/components/ToolCard";
import { categories, getCategoryBySlug, toolsInCategory } from "@/lib/registry";
import { breadcrumbLd, categoryDescription, pageMetadata } from "@/lib/seo";
import { guidePath, guides } from "@/lib/guides";
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

// A short, genuine introduction per category: what the tools are for and how they differ.
const INTROS: Record<CategoryId, string> = {
  social: "Save public videos, Reels, photos and clips from a link. Each platform has its own page with the formats it supports, and the universal downloader recognises the platform for you. Only public posts work: nothing that needs a login, and nothing private.",
  qr: "Make static QR codes that hold your link, Wi-Fi details or contact card directly, so they never expire and nothing is tracked. Download them as PNG for screens or SVG for print, or scan a code with your camera or an image.",
  image: "Compress, resize, convert and crop JPG, PNG and WebP images in your browser. Nothing is uploaded, there's no watermark, and you see the result and its file size before you download it.",
  seo: "Write and check the pieces search engines read: titles, meta descriptions, Open Graph tags, robots.txt, sitemaps and structured data. Preview how a page may look in search results and when shared.",
  developer: "Everyday helpers for code and data: format and validate JSON, encode and decode Base64 and URLs, decode JWTs, generate UUIDs and hashes, test regular expressions and minify HTML, CSS and JavaScript. All of it runs locally.",
  text: "Count words and characters, change letter case, compare two texts, and generate passwords or placeholder text. Results update as you type.",
  calculators: "Quick, clear calculators for percentages, age, BMI, loan repayments and compound interest, with the formula explained so you can check the result.",
  pdf: "Merge, split, compress and rotate PDFs, and convert between PDF and images, without uploading your documents: everything runs in your browser.",
  video: "Small video jobs without an editor: save a frame as an image, extract the audio as WAV, or check a file's resolution, duration and bitrate. Your video stays on your device.",
  converters: "Convert units, colours, Unix timestamps, number bases and time zones, with results that update as you type.",
  utilities: "Simple everyday helpers: random numbers without repeats, and a stopwatch and countdown timer.",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = getCategoryBySlug((await params).slug);
  if (!c) return {};
  const list = toolsInCategory(c.id);
  return pageMetadata({ title: TITLES[c.id], description: categoryDescription(c.description, list.map((t) => t.name)), path: categoryPath(c.slug) });
}

export default async function CategoryPage({ params }: Props) {
  const c = getCategoryBySlug((await params).slug);
  if (!c) notFound();
  const list = toolsInCategory(c.id);
  const ids = new Set(list.map((t) => t.slug));
  const catGuides = guides.filter((g) => g.tools.some((s) => ids.has(s)));
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
        <p>{INTROS[c.id]}</p>
      </header>
      <div className="tool-grid">
        {list.map((t, i) => [
          <ToolCard key={t.slug} tool={t} headingLevel={2} />,
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
            Guides
          </h2>
          <ul>
            {catGuides.map((g) => (
              <li key={g.slug}>
                <a href={guidePath(g.slug)} className="link">{g.h1}</a>
              </li>
            ))}
          </ul>
        </section>
      )}
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
