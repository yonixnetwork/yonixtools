import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "YoniXTools",
    short_name: "YoniXTools",
    description: "Download videos, images and audio from supported platforms, plus free private tools for PDFs, images, video, QR codes and more.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    background_color: "#0a0b0f",
    theme_color: "#0a0b0f",
    categories: ["utilities", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Downloader", short_name: "Download", url: "/social-media-downloader/?source=pwa-shortcut", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "All tools", short_name: "Tools", url: "/tools/?source=pwa-shortcut", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Image Compressor", short_name: "Compress", url: "/image-compressor/?source=pwa-shortcut", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "PDF Merger", short_name: "PDF", url: "/pdf-merger/?source=pwa-shortcut", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
