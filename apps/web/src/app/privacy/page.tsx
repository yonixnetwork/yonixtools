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
          <h2>Advertising</h2>
          <p>
            YoniXTools is free because it shows advertising from <strong>Adsterra</strong>, a third-party ad network. Ads are loaded in separate frames from a
            separate advertising address (ads.yonixtools.com), below or beside the tools, never inside them. Your browser keeps those frames apart from this site: the
            ad code can&apos;t see the links you paste, your files, your results or this site&apos;s cookies, and it can&apos;t redirect the page. Adsterra and its
            advertisers may use cookies, device identifiers and similar technologies in those frames to show, measure and limit ads, and they receive technical data such as your IP address, browser and the page you are on. See{" "}
            <a href="https://adsterra.com/privacy-policy/" rel="noopener noreferrer" target="_blank">Adsterra&apos;s privacy policy</a> for how they use it and your
            choices. You can block or delete these cookies in your browser settings, or use an ad blocker; the tools keep working either way.
          </p>
          <p>
            We may also show a small banner from <strong>Monetag</strong> on some tool pages (never on the downloader), loaded the same way in a separate frame.
            Monetag and its advertisers may use cookies, device identifiers and similar technologies, and receive technical
            data such as your IP address, browser and the page you are on. See{" "}
            <a href="https://monetag.com/privacy-policy/" rel="noopener noreferrer" target="_blank">Monetag&apos;s privacy policy</a>. We don&apos;t use push
            notification ads, and nothing subscribes you to notifications.
          </p>
          <p>Advertising never decides whether a tool works: there are no forced ad clicks, countdowns or redirects, and pop-under or redirect ad formats are not used.</p>
        </section>
        <section>
          <h2>App installation and offline use</h2>
          <p>
            If you install YoniXTools as an app, your browser keeps a copy of the site&apos;s pages and files so it opens faster and some pages work offline. Downloads
            and anything you process are never stored in that copy. Whether you dismissed the install invitation is remembered in your browser for 30 days.
          </p>
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
