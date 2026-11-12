import { AdSlot } from "@/components/AdSlot";
import { MonetagZones } from "@/components/MonetagZones";
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ToolsExplorer } from "@/components/ToolsExplorer";
import { tools } from "@/lib/registry";

export const metadata: Metadata = {
  title: { absolute: "All Free Online Tools – Search YoniXTools" },
  description: `Search and browse all ${tools.length} YoniXTools tools: social media downloaders, QR codes, image, SEO, developer, text and calculator tools.`,
  alternates: { canonical: "/tools/" },
};

export default function ToolsPage() {
  return (
    <div className="container">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "All tools" }]} />
      <header className="tool-hero" style={{ display: "block" }}>
        <h1>All tools</h1>
        <p>Search by what you want to do. Synonyms and small typos are understood.</p>
      </header>
      <ToolsExplorer />
      <AdSlot unit="native" className="ad-native ad-wide-only" />
      <MonetagZones page={{ kind: "tools" }} narrowOnly />
    </div>
  );
}
