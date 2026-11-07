import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How YoniXTools handles your data: browser tools process files on your device, and only a theme preference and a recently-used list are stored locally.",
  alternates: { canonical: "/privacy/" },
};

export default function Privacy() {
  return (
    <div className="container" style={{ maxWidth: 760 }}>
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Privacy" }]} />
      <article className="prose" style={{ padding: "20px 0" }}>
        <h1 style={{ fontSize: "2rem", marginBottom: 16 }}>Privacy</h1>
        <section>
          <h2>Browser tools</h2>
          <p>Tools marked &quot;Runs in your browser&quot; process your images, files and text entirely on your device. That content is not uploaded to YoniXTools.</p>
        </section>
        <section>
          <h2>Stored on your device</h2>
          <p>Your browser&apos;s local storage holds your light or dark theme choice, a short list of tools you used recently, your recent downloads list and the last quality you chose. Both stay on your device, and clearing your site data removes them. YoniXTools does not set advertising or analytics cookies.</p>
        </section>
        <section>
          <h2>Social media downloader</h2>
          <p>
            Links you submit are sent to the YoniXTools server so it can fetch the public media. The prepared file is deleted automatically at most 15 minutes after it is
            ready, and never kept permanently. Server logs record the platform, timings and a short anonymous fingerprint of the link (never the full link or your files).
            Your IP address is used briefly in memory for rate limiting.
          </p>
          <p>
            Your recent downloads list is stored only in your browser and contains the title, platform and chosen quality, never the link. You can clear it from the
            downloader at any time.
          </p>
        </section>
      </article>
    </div>
  );
}
