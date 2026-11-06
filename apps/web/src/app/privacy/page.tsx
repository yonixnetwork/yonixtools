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
          <p>Your browser&apos;s local storage holds your light or dark theme choice and a short list of tools you used recently. Both stay on your device, and clearing your site data removes them. YoniXTools does not set advertising or analytics cookies.</p>
        </section>
        <section>
          <h2>Social media downloader</h2>
          <p>When the download service launches, links you submit will be sent to the YoniXTools server so it can fetch the public media. Downloaded files will be stored only temporarily, deleted automatically shortly after download, and never kept permanently. This page will be updated with the exact retention periods before the service goes live.</p>
        </section>
      </article>
    </div>
  );
}
