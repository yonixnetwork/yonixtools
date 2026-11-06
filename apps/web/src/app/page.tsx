import { ArrowRight, Gauge, Link as LinkIcon, ShieldCheck, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { Downloader } from "@/components/Downloader";
import { FaqList } from "@/components/Faq";
import { Icon, PlatformIcon } from "@/components/Icon";
import { JsonLd } from "@/components/JsonLd";
import { Recommended } from "@/components/Recommended";
import { ToolCard } from "@/components/ToolCard";
import { PLATFORMS } from "@/lib/downloader/detect";
import { categories, editorsPicks, getTool, popularSlugs, recentlyAdded, tools, toolsInCategory } from "@/lib/registry";
import { toCard } from "@/lib/registry/cards";
import { faqLd, websiteLd } from "@/lib/seo";
import { categoryPath, toolPath } from "@/lib/site";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const HOME_FAQ = [
  { q: "What is YoniXTools?", a: "A free website with two parts: a universal downloader for public social media posts, and a growing collection of online tools for images, QR codes, SEO, development, text and everyday calculations." },
  { q: "Do I need to choose the platform before pasting a link?", a: "No. Paste any supported link and YoniXTools works out whether it's Instagram, TikTok, YouTube, Facebook, X, Pinterest, Reddit or Vimeo, along with the kind of post it is." },
  { q: "Are my files uploaded when I use the image and text tools?", a: "No. Tools marked as running in your browser process everything on your device. Your images, text and passwords are never sent to a server." },
  { q: "Is YoniXTools free?", a: "Yes. Every tool is free to use, with no account and no watermark." },
  { q: "Can I download private posts?", a: "No. The downloader only handles content that is publicly available without logging in, and it never bypasses privacy settings or DRM. Only download content you have the right to save." },
];

const WHY = [
  { icon: <LinkIcon aria-hidden />, title: "One link, any platform", text: "Paste and go. Platform and content type are detected automatically." },
  { icon: <ShieldCheck aria-hidden />, title: "Private by design", text: "Browser tools run on your device. Files and text never leave it." },
  { icon: <Gauge aria-hidden />, title: "Fast on any connection", text: "Pre-rendered pages and small, lazy-loaded tool code." },
  { icon: <Sparkles aria-hidden />, title: "Free, no sign-up", text: "No accounts, no watermarks, no daily limits on browser tools." },
];

export default function Home() {
  const popular = popularSlugs.map((s) => getTool(s)!);
  const recent = recentlyAdded(4);
  return (
    <>
      <JsonLd data={websiteLd()} />
      <JsonLd data={faqLd(HOME_FAQ)} />

      <section className="hero">
        <div className="container">
          <span className="eyebrow">Universal downloader</span>
          <h1>Download from any social platform with one link</h1>
          <p className="lede">Paste a public link from Instagram, TikTok, YouTube, Facebook, X, Pinterest or Reddit, and pick the quality you want. There are also {tools.filter((t) => t.runsIn === "browser").length} free tools that run privately in your browser.</p>
          <Downloader />
          <div className="platform-row" aria-label="Supported platforms">
            {Object.values(PLATFORMS)
              .filter((p) => p.id !== "vimeo")
              .map((p) => (
                <a key={p.id} href={toolPath(p.toolSlug)} className="platform-pill">
                  <PlatformIcon platform={p.id} />
                  {p.name}
                </a>
              ))}
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="popular-h">
        <div className="container">
          <div className="section-head">
            <div>
              <h2 id="popular-h">Popular tools</h2>
              <p>Free, instant and private. They run entirely in your browser.</p>
            </div>
            <a className="link-more" href="/tools/">
              All tools <ArrowRight aria-hidden />
            </a>
          </div>
          <div className="tool-grid cols-4">
            {popular.map((t) => <ToolCard key={t.slug} tool={t} />)}
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="cat-h">
        <div className="container">
          <div className="section-head">
            <div>
              <h2 id="cat-h">Browse by category</h2>
              <p>Every tool has its own page with instructions and answers to common questions.</p>
            </div>
          </div>
          <div className="cat-grid">
            {categories.map((c) => (
              <a key={c.id} href={categoryPath(c.slug)} className="cat-tile">
                <span className="tool-icon">
                  <Icon name={c.icon} />
                </span>
                <h3>{c.name}</h3>
                <p>{c.description}</p>
                <span className="count">{toolsInCategory(c.id).length} tools</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="new-h">
        <div className="container">
          <div className="section-head">
            <div>
              <h2 id="new-h">Recently added</h2>
              <p>The newest tools on YoniXTools.</p>
            </div>
          </div>
          <div className="tool-grid cols-4">
            {recent.map((t) => <ToolCard key={t.slug} tool={t} />)}
          </div>
        </div>
      </section>

      <Recommended cards={tools.map(toCard)} picks={editorsPicks} />

      <section className="section" aria-labelledby="why-h">
        <div className="container">
          <div className="section-head">
            <div>
              <h2 id="why-h">Why use YoniXTools</h2>
            </div>
          </div>
          <div className="why-grid">
            {WHY.map((w) => (
              <div key={w.title} className="why-item">
                <span className="tool-icon">{w.icon}</span>
                <h3>{w.title}</h3>
                <p>{w.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="faq-h">
        <div className="container" style={{ maxWidth: 820 }}>
          <div className="section-head">
            <h2 id="faq-h">Frequently asked questions</h2>
          </div>
          <FaqList faqs={HOME_FAQ} />
        </div>
      </section>
    </>
  );
}
