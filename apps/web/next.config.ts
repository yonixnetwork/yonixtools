import type { NextConfig } from "next";

// Fully static export: every page (homepage, tool landing pages, categories,
// sitemap) is pre-rendered HTML. The downloader backend is a separate service
// reached over HTTPS from the browser (NEXT_PUBLIC_DOWNLOADER_API_URL).
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
