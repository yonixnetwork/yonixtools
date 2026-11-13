import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-static";

/**
 * Everything public may be crawled, including CSS, JS, fonts and images under /_next/ (search engines
 * need them to render pages). Kept out: the password-protected admin area and the downloader API,
 * which have nothing to index. This is not what protects them: /admin/ needs a password and the API
 * only answers the site's own requests.
 */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/admin/", "/api/"] }], sitemap: absoluteUrl("/sitemap.xml") };
}
