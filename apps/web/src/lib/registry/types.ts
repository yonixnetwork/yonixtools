export type CategoryId =
  | "social"
  | "qr"
  | "image"
  | "pdf"
  | "seo"
  | "developer"
  | "text"
  | "calculators"
  | "video"
  | "converters"
  | "utilities";

/**
 * live             – fully working in the browser today.
 * awaiting-backend – needs the downloader service. Available (and indexable)
 *                    only in builds where NEXT_PUBLIC_DOWNLOADER_API_URL is set;
 *                    otherwise the page says downloading is not live, is
 *                    noindex and is left out of the sitemap.
 */
export type ToolStatus = "live" | "awaiting-backend";

export interface Faq {
  q: string;
  a: string;
}

export interface Category {
  id: CategoryId;
  slug: string;
  name: string;
  description: string;
  icon: string;
}

export interface Tool {
  slug: string;
  name: string;
  /** One-line summary used on cards and in search suggestions. */
  tagline: string;
  category: CategoryId;
  status: ToolStatus;
  /** "browser" = runs entirely on the visitor's device; "server" = needs the backend. */
  runsIn: "browser" | "server";
  icon: string;
  /** Platform id for downloader tools (renders the platform's mark). */
  platform?: string;
  keywords: string[];
  synonyms: string[];
  related: string[];
  addedAt: string;
  seo: { title: string; description: string };
  content: {
    intro: string;
    steps: string[];
    features: string[];
    faqs: Faq[];
  };
}

export interface PlannedTool {
  name: string;
  category: CategoryId;
  keywords: string[];
}
