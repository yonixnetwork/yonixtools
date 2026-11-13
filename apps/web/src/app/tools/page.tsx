import { AdPlacement } from "@/components/AdPlacement";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ToolsExplorer } from "@/components/ToolsExplorer";
import { tools } from "@/lib/registry";

export const metadata: Metadata = pageMetadata({
  title: "All Free Online Tools – Search YoniXTools",
  description: `Search and browse all ${tools.length} YoniXTools tools: social media downloaders, QR codes, image, SEO, developer, text and calculator tools.`,
  path: "/tools/",
});

export default function ToolsPage() {
  return (
    <div className="container">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "All tools" }]} />
      <header className="tool-hero" style={{ display: "block" }}>
        <h1>All tools</h1>
        <p>Search by what you want to do. Synonyms and small typos are understood.</p>
      </header>
      <ToolsExplorer gridAd={<AdPlacement page="listing" position="in-grid" className="ad-grid-break" />} />
      <AdPlacement page="listing" position="after-list" monetag={{ kind: "tools" }} />
    </div>
  );
}
