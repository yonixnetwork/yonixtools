import type { Metadata, Viewport } from "next";
import { OG_IMAGE } from "./seo";
import { site } from "./site";

/** Site-wide metadata shared by both root layouts (English and localized). Pages set their own title, description, canonical and social cards. */
export const rootMetadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `Free Online Tools & Social Media Downloader | ${site.name}`, template: `%s | ${site.name}` },
  description: site.description,
  applicationName: site.name,
  openGraph: { siteName: site.name, type: "website", locale: "en_US", images: [OG_IMAGE] },
  twitter: { card: "summary_large_image", images: [OG_IMAGE.url] },
  icons: { icon: [{ url: "/favicon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }], apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "YoniXTools", statusBarStyle: "black-translucent" },
  // Search-engine ownership tags (only when the build sets them): Google Search Console, Bing Webmaster Tools.
  ...(site.googleVerification || site.bingVerification
    ? { verification: { ...(site.googleVerification ? { google: site.googleVerification } : {}), ...(site.bingVerification ? { other: { "msvalidate.01": site.bingVerification } } : {}) } }
    : {}),
  // Monetag website ownership verification (exact value supplied by Monetag). Verification only: no Monetag ad code.
  other: { monetag: "d69414fd01256df4752b5cfc142c85c0" },
};

export const rootViewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0b0f" },
  ],
};
