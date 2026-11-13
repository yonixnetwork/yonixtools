import "./fonts.css";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Footer } from "@/components/Footer";
import { Header, type NavCategory } from "@/components/Header";
import { InstallPrompt } from "@/components/InstallPrompt";
import { categories, toolsInCategory } from "@/lib/registry";
import { ThemeScript } from "@/components/ThemeScript";
import { OG_IMAGE } from "@/lib/seo";
import { categoryPath, site, toolPath } from "@/lib/site";

export const metadata: Metadata = {
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0b0f" },
  ],
};

// Changes on every build: a new service worker URL makes browsers pick up the new version.
const BUILD_VERSION = process.env.NEXT_PUBLIC_BUILD_ID || new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);

const nav: NavCategory[] = categories.map((c) => ({
  name: c.name,
  href: categoryPath(c.slug),
  icon: c.icon,
  tools: toolsInCategory(c.id).map((t) => ({ name: t.name, href: toolPath(t.slug) })),
}));

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <Header nav={nav} />
        <main id="main">{children}</main>
        <Footer />
        <InstallPrompt version={BUILD_VERSION} />
      </body>
    </html>
  );
}
