export const site = {
  name: "YoniXTools",
  url: (process.env.NEXT_PUBLIC_SITE_URL || "https://yonixtools.com").replace(/\/+$/, ""),
  tagline: "Free online tools and a universal social media downloader",
  description:
    "Free online tools for everyday tasks: merge PDFs, compress images, make QR codes and save public TikTok, Instagram and Facebook videos. No sign-up.",
  downloaderApiUrl: (process.env.NEXT_PUBLIC_DOWNLOADER_API_URL || "").replace(/\/+$/, ""),
  googleVerification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || "",
  /** Bing Webmaster Tools verification code (msvalidate.01), optional. */
  bingVerification: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION || "",
};

/** True when this build is wired to a downloader backend (NEXT_PUBLIC_DOWNLOADER_API_URL). */
export const backendConfigured = site.downloaderApiUrl.length > 0;

export function absoluteUrl(path: string): string {
  return `${site.url}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Canonical path for a tool landing page (trailing slash matches the static export). */
export const toolPath = (slug: string) => `/${slug}/`;
export const categoryPath = (slug: string) => `/category/${slug}/`;
