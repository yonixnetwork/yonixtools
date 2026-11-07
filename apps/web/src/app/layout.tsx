import "@fontsource-variable/inter";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Footer } from "@/components/Footer";
import { Header, type NavCategory } from "@/components/Header";
import { categories, toolsInCategory } from "@/lib/registry";
import { ThemeScript } from "@/components/ThemeScript";
import { categoryPath, site, toolPath } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name}: Social Media Downloader & Free Online Tools`, template: `%s | ${site.name}` },
  description: site.description,
  applicationName: site.name,
  openGraph: { siteName: site.name, type: "website", locale: "en_US" },
  twitter: { card: "summary" },
  icons: { icon: "/favicon.svg" },
  ...(site.googleVerification ? { verification: { google: site.googleVerification } } : {}),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0b0f" },
  ],
};

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
      </body>
    </html>
  );
}
