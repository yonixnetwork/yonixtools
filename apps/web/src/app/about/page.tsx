import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { FaqList } from "@/components/Faq";
import { JsonLd } from "@/components/JsonLd";
import { PLATFORMS } from "@/lib/downloader/detect";
import { PLATFORM_STATUS, STATE_LABEL, VERIFIED_ON } from "@/lib/downloader/platform-status";
import { faqLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Help & About",
  description: "How to use the YoniXTools downloader, which platforms work today, what to do when a download fails, and how your data is handled.",
  alternates: { canonical: "/about/" },
};

const HELP_FAQ = [
  { q: "How do I download a video?", a: "Copy the link from the app's Share menu (Copy link), paste it into the box on the home page and press Download. Choose a quality and your browser starts saving the file straight away." },
  { q: "The page said “Download requested”. Did it work?", a: "Your browser was asked to save the file but we couldn't confirm it started (some browsers hide this). Check your downloads. If nothing is there, use the “Save it here” link next to the quality." },
  { q: "Where do files go on a phone?", a: "On Android they go to the Downloads folder (or the Files app). On iPhone, Safari saves them in the Files app under Downloads; tap the download icon in the address bar to see them." },
  { q: "Why does a link fail?", a: "The most common reasons are a private or deleted post, a post that needs a login, a region restriction, or a platform blocking server requests. The error message says which one applies." },
  { q: "Why isn't YouTube supported?", a: "YouTube asks cloud servers to sign in to prove they aren't bots, and refuses our server even with every method we tested. We don't use accounts, cookies or paid proxies to get around platform restrictions, so YouTube isn't offered." },
  { q: "How do I save several photos at once?", a: "When a post has more than one photo or video, each item gets its own preview and Download button. Tick the items you want, or press Select all, then Download selected as ZIP." },
  { q: "Is there a size or length limit?", a: "Yes, very large or very long videos are refused to keep the service fast for everyone. The limit is shown in the error if you hit it." },
  { q: "Can I download private content?", a: "No. Only content that is publicly visible without logging in. YoniXTools never bypasses privacy settings, logins or DRM. Only download what you have the right to save." },
];

export default function About() {
  return (
    <div className="container" style={{ maxWidth: 860 }}>
      <JsonLd data={faqLd(HELP_FAQ)} />
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Help & About" }]} />
      <article className="prose" style={{ padding: "20px 0" }}>
        <h1 style={{ fontSize: "2rem", marginBottom: 12 }}>Help &amp; About</h1>
        <p>
          YoniXTools is a free universal downloader for public social media posts plus a set of tools that run privately in your browser. There are no accounts and no
          watermarks.
        </p>
        <section>
          <h2>Platform status</h2>
          <p>Checked {VERIFIED_ON} with real downloads from a cloud server, like the one YoniXTools runs on.</p>
          <ul>
            {PLATFORM_STATUS.map((p) => (
              <li key={p.id}>
                <strong>{PLATFORMS[p.id].name}</strong>: {STATE_LABEL[p.state]}. {p.content}. {p.note}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>Questions</h2>
          <FaqList faqs={HELP_FAQ} />
        </section>
        <section>
          <h2>Install YoniXTools</h2>
          <ul>
            <li><strong>Android (Chrome, Edge, Samsung Internet):</strong> tap <b>Install</b> when YoniXTools offers it, or use the browser menu → <b>Install app</b> / <b>Add to Home screen</b>.</li>
            <li><strong>Windows, macOS, Linux, ChromeOS (Chrome or Edge):</strong> click the install icon in the address bar, or menu → <b>Install YoniXTools</b>.</li>
            <li><strong>iPhone and iPad (Safari):</strong> tap <b>Share</b>, then <b>Add to Home Screen</b>. Safari has no automatic install prompt.</li>
            <li><strong>Firefox and other browsers:</strong> some don&apos;t support installing web apps; bookmark the site instead.</li>
          </ul>
          <p>The installed app is this website running in its own window. It isn&apos;t a separate download from an app store.</p>
        </section>
        <section>
          <h2>Privacy</h2>
          <p>
            Links you paste into the downloader are sent to our server so it can fetch the public media. Files are kept for at most 15 minutes and then deleted. Server
            logs keep only the platform and a short anonymous fingerprint of the link, never the full link. Browser tools never upload your files. The site shows
            labelled third-party ads from Adsterra in separate frames, outside the tools. See the{" "}
            <a href="/privacy/">privacy page</a>.
          </p>
        </section>
      </article>
    </div>
  );
}
