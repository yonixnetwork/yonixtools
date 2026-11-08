import { ArrowRight, CircleAlert, CircleCheck, CircleMinus, Gauge, Link as LinkIcon, ShieldCheck, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { AdSlot } from "@/components/AdSlot";
import { MonetagZones } from "@/components/MonetagZones";
import { Downloader } from "@/components/Downloader";
import { FaqList } from "@/components/Faq";
import { Icon, PlatformIcon } from "@/components/Icon";
import { JsonLd } from "@/components/JsonLd";
import { Recommended } from "@/components/Recommended";
import { ToolCard } from "@/components/ToolCard";
import { PLATFORMS } from "@/lib/downloader/detect";
import { PLATFORM_STATUS, STATE_LABEL, VERIFIED_ON } from "@/lib/downloader/platform-status";
import { categories, editorsPicks, getTool, popularSlugs, recentlyAdded, tools, toolsInCategory } from "@/lib/registry";
import { toCard } from "@/lib/registry/cards";
import { faqLd, websiteLd } from "@/lib/seo";
import { categoryPath, toolPath } from "@/lib/site";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const HOME_FAQ = [
  { q: "What is YoniXTools?", a: "A free website with two parts: a universal downloader for public social media posts, and a growing collection of online tools for images, QR codes, SEO, development, text and everyday calculations." },
  { q: "Do I need to choose the platform before pasting a link?", a: "No. Paste a link and YoniXTools works out which platform it's from and what kind of post it is. The Supported platforms section shows what currently works on each one." },
  { q: "Can I download every photo of an Instagram post?", a: "Yes. Paste the post link and every photo and video in it is shown with its own preview and download button. Select several to download them together as a ZIP." },
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
  const working = PLATFORM_STATUS.filter((p) => p.state === "working").slice(0, 6);
  return (
    <>
      <JsonLd data={websiteLd()} />
      <JsonLd data={faqLd(HOME_FAQ)} />

      <section className="hero hero-compact">
        <div className="container">
          <h1>Download Videos, Images and Audio from Supported Platforms</h1>
          <p className="lede">Save media in available formats and qualities from platforms you are permitted to download from. Paste a public link, pick a quality, and the download starts.</p>
          <Downloader />
          <div className="platform-row" aria-label="Working platforms">
            {working.map((p) => (
              <span key={p.id} className="platform-pill">
                <PlatformIcon platform={p.id} />
                {PLATFORMS[p.id].name.replace(" (Twitter)", "")}
              </span>
            ))}
            <a href="#platforms-h" className="platform-pill platform-more">All platforms</a>
          </div>
          <nav className="quick-tools" aria-label="Popular tools">
            <span className="muted">Popular:</span>
            {popular.slice(0, 6).map((t) => (
              <a key={t.slug} href={toolPath(t.slug)}>
                {t.name}
              </a>
            ))}
            <a href="/tools/" className="quick-all">All tools <ArrowRight aria-hidden /></a>
          </nav>
        </div>
      </section>

      <div className="container">
        <AdSlot responsive="leaderboard" />
      </div>

      <section className="section" aria-labelledby="platforms-h">
        <div className="container">
          <div className="section-head">
            <div>
              <h2 id="platforms-h">Supported platforms</h2>
              <p>Checked {VERIFIED_ON} with real downloads from a cloud server. Only public content, never private posts or DRM.</p>
            </div>
          </div>
          <ul className="platform-status" role="list">
            {PLATFORM_STATUS.map((p) => (
              <li key={p.id} className={`ps-${p.state}`} data-platform={p.id}>
                <span className="ps-icon">
                  <PlatformIcon platform={p.id} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <h3>
                    {PLATFORMS[p.id].name}{" "}
                    <span className={`badge ${p.state === "working" ? "badge-live" : p.state === "limited" ? "badge-pending" : "badge-blocked"}`}>
                      {p.state === "working" ? <CircleCheck aria-hidden /> : p.state === "limited" ? <CircleMinus aria-hidden /> : <CircleAlert aria-hidden />}
                      {STATE_LABEL[p.state]}
                    </span>
                  </h3>
                  <p className="ps-content">{p.content}</p>
                  <p className="muted ps-note">{p.note}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="container">
        <AdSlot unit="native" className="ad-native" />
        <MonetagZones />
      </div>

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
