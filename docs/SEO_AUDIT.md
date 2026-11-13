# SEO audit and search-discovery upgrade (13 Nov 2026)

**Scope:** an upgrade to the existing site, not a rebuild. No ranking or indexing is promised: this makes every useful page easy to crawl, understand and index.

**Live site:** audited on 13 Nov 2026. **These changes are not deployed.**

## 1. Live audit (before the changes)

| Check | Result on https://yonixtools.com |
|---|---|
| `/robots.txt` | 200 `text/plain`. `Allow: /`, `Sitemap: https://yonixtools.com/sitemap.xml` |
| `/sitemap.xml` | 200 `text/xml`, valid XML, 74 URLs. **This is the working sitemap** |
| `/sitemap_index.xml` | 404. There's no index: one sitemap is enough at this size (the limit is 50,000 URLs) |
| `https://www.yonixtools.com/` | 301 → `https://yonixtools.com/` |
| `/pdf-merger` (no slash) | 301 → `/pdf-merger/` |
| `http://` | Not testable from the audit environment (its proxy only tunnels HTTPS). The edge redirects port 80 to HTTPS (`deploy/nginx/edge-host.conf`); check it with the curl line in §8 |
| All 74 sitemap URLs (as Googlebot) | All 200. Self-canonical, no `noindex`, exactly one H1, unique titles and descriptions, image alt text present |
| Googlebot (desktop and smartphone) and Bingbot | 200 for pages, robots.txt, sitemap and assets. Nothing blocks them |
| Unsupported pages (`/youtube-downloader/`, `/reddit-downloader/`) | 200 with `noindex, follow`, not in the sitemap. Correct |
| `/offline/` | `noindex, nofollow`. Correct |
| Search results `/tools/?q=…` | Canonical → `/tools/`. Correct, no duplicate |
| `/admin/` | 401 (password). Not in the sitemap |
| Mobile Lighthouse, homepage | Performance 98, SEO 100, accessibility 100, best practices 96. LCP 1.7 s, CLS 0, TBT 150 ms, server response 50 ms |

**Problems found and fixed in this change:**
- **Social cards:**
  - No page had a share image (`og:image`). Next.js replaces a parent's Open Graph block instead of merging it, so tool and category pages had none.
  - The X/Twitter card was the small `summary` with no image.
- **Descriptions:**
  - The homepage description was 194 characters, so it was truncated in results.
  - Category descriptions were cut mid-word ("…Facebook V", "…QR Code Scanne").
  - One tool description (Time Zone Converter) was 161 characters.
- **Sitemap dates:** `lastmod` was a single hard-coded date for every non-tool page, plus `changefreq`/`priority`, which Google ignores.
- **Structured data:** no Organization schema.
- **Thin category pages:** about 200 words, mostly tool cards.
- **Content:** no editorial or how-to pages.
- **Twitch:** clips work, through the universal downloader and a live end-to-end test, but there was no page for them.

## 2. Cloudflare review

**yonixtools.com is not behind Cloudflare.**
- Responses come straight from the droplet's nginx: `server: nginx`, no `cf-ray` and no Cloudflare headers.
- The DNS is at Hostinger, with A records pointing to the droplet.
- So no Cloudflare WAF, bot-fight, cache or redirect rule can interfere with crawling, the sitemap, robots.txt, redirects or assets.
- Cloudflare is only used for temporary staging tunnels (`*.trycloudflare.com`). Those are password-protected, `noindex`, and never linked or listed.

**No Cloudflare change is needed.** If the site is ever put behind Cloudflare:
- keep Bot Fight Mode's "verified bots" allowed;
- don't add a rule that challenges `/robots.txt`, `/sitemap.xml` or `/_next/static/`.

## 3. What changed

**Sitemap (`/sitemap.xml`):**
- **Source:** generated from the same registries the pages are built from. A tool or guide that is added, hidden or removed updates it automatically.
- **Contains:** absolute `https://yonixtools.com/…/` URLs, each with a real `lastmod`:
  - for tools, `Tool.updatedAt`, or the date it was added;
  - for other pages, `lib/content-dates.ts`;
  - for guides, `Guide.updated`.
- **Removed:** `changefreq` and `priority`.
- **Size:** 81 URLs in the production configuration (74 + Twitch page + guides index + 5 guides).

**robots.txt:**
```
User-Agent: *
Allow: /
Disallow: /admin/
Disallow: /api/

Sitemap: https://yonixtools.com/sitemap.xml
```
- **Still allowed:** CSS, JS, fonts and images (`/_next/`, `/icons/`, `/og-image.png`).
- **Protection doesn't rely on robots.txt:** `/admin/` needs a password, the API answers only the site's own requests, and the ad documents return 404 on this host.

**Metadata on every page** (one helper, `pageMetadata` in `lib/seo.ts`):
- unique title and description;
- canonical URL;
- Open Graph: title, description, `og:url`, `og:image` (`/og-image.png`, 1200×630), site name, locale;
- X/Twitter `summary_large_image` card;
- an optional Bing verification tag (`BING_SITE_VERIFICATION`), next to the existing Google one (`GOOGLE_SITE_VERIFICATION`).

**Structured data** (validated by tests: JSON parses, schema.org context, required properties):

| Page | Types |
|---|---|
| Home | Organization (name, URL, logo), WebSite, FAQPage |
| Tool pages | WebApplication (free offer, browser requirements), BreadcrumbList, FAQPage |
| Category pages | CollectionPage with ItemList, BreadcrumbList |
| Guides index | CollectionPage with ItemList, BreadcrumbList |
| Guides | Article (real datePublished and dateModified, YoniXTools as author and publisher, image), BreadcrumbList |

- **Nothing invented:** no ratings, reviews, download counts or user statistics. A test fails if any appear.
- **Rich results:** Google shows FAQ rich results only for a few government and health sites. FAQPage is valid markup but will rarely produce one.

**New pages:**
- **`/twitch-clip-downloader/`:** clips only. Live streams and full broadcasts are refused, and the page says so.
- **`/guides/`, with five guides:**
  - [How to merge PDF files online](/guides/how-to-merge-pdf-files/)
  - [How to compress images online](/guides/how-to-compress-images/)
  - [How to save public TikTok, Instagram and Facebook videos (when you're allowed to)](/guides/how-to-save-public-social-media-videos/)
  - [Free online video tools](/guides/free-online-video-tools/)
  - [Free online tools to bookmark for 2027](/guides/free-online-tools-2027/), the only year-specific page. It carries "Reviewed <date>" and `reviewBy: 2027-06-30`; a unit test fails after that date as a reminder to review it. No other title mentions a year.

**Internal links** (all ordinary HTML links):
- **Guides are linked from:**
  - the header (desktop navigation and the mobile drawer);
  - the footer;
  - a Guides section on the homepage;
  - each category page;
  - the sidebar of every tool a guide covers.
- **Guides link to the tools they describe.** A test follows every internal link on every sitemap page and requires 200 with no redirect hop.

**Category pages:** each gets a short, genuine introduction (what the tools do and how they differ) and its related guides.

**Titles refined to match search intent:**
- **PDF Merger:** "Merge PDF Files Online – Free PDF Merger, No Upload"
- **TikTok:** "TikTok Video Downloader – Download TikTok Videos Online"
- **Image Compressor:** "Image Compressor – Compress Images Online, JPG & WebP"
- **Homepage:** "Free Online Tools & Social Media Downloader | YoniXTools"

## 4. Keyword mapping

These are intent themes from your brief and the tools' real features, not measured search volumes. No keyword tool was available. Check volumes and competition in Search Console after a few weeks of data.

| Theme | Page | How the page satisfies it |
|---|---|---|
| free online tools, online tools for everyday tasks, free web utilities | `/`, `/tools/`, `/guides/free-online-tools-2027/` | All 60 tools listed and searchable; no sign-up |
| TikTok video downloader, download TikTok videos online | `/tiktok-downloader/` | Paste a link, preview, pick a format; public posts only |
| Instagram downloader, Instagram video / Reels downloader | `/instagram-downloader/` | Reels, videos, photos, every carousel item |
| Facebook video downloader, download Facebook videos online | `/facebook-downloader/` | Videos and Reels, SD/HD, fb.watch links |
| Twitch clip downloader | `/twitch-clip-downloader/` | Clips as MP4. **"Twitch video downloader" isn't targeted:** full broadcasts aren't supported |
| merge PDF online, combine PDF files, free PDF merger | `/pdf-merger/`, `/guides/how-to-merge-pdf-files/` | Reorder, merge, no upload, no watermark |
| online image converter, resize images online, compress images online | `/image-converter/`, `/image-resizer/`, `/image-compressor/`, `/guides/how-to-compress-images/` | Browser-only processing, size comparison |
| online video tools, video utilities | `/category/video-tools/`, `/guides/free-online-video-tools/` | Frame extraction, audio extraction, file info |
| how to download from supported platforms (when permitted) | `/guides/how-to-save-public-social-media-videos/` | Permission first, steps, per-platform limits |

**Not created, by design:** YouTube, Vimeo and Reddit pages. They don't work, stay `noindex`, and aren't linked from guides (a test enforces this).

## 5. Pages excluded from the sitemap

| Excluded | Why |
|---|---|
| `/youtube-downloader/`, `/reddit-downloader/` | Platform not working; the pages are `noindex, follow` |
| `/offline/` | PWA offline fallback, `noindex` |
| `/admin/…` | Password-protected administrator area |
| `/api/…` | Downloader API, not pages |
| `/ad-frame.html`, `/ad-test.html` | Advertising documents; 404 on this host, served only on ads.yonixtools.com |
| `/tools/?q=…` and any other query URL | Search results; canonical is `/tools/` |
| `/404.html`, unknown paths | Not pages |
| Staging addresses | Never part of this site's build |

## 6. Test results (local, 13 Nov 2026)

| Suite | Result |
|---|---|
| New SEO unit tests (`tests/unit/seo.test.ts`), production configuration | 6 passed. They check: sitemap URLs canonical and private paths absent; hidden tools never listed; lastmod real and not in the future; robots rules; title and description lengths, all unique; category descriptions not truncated; every guide link resolves; no unsupported-platform links; review dates |
| New site-wide crawl (`tests/e2e/seo-sitewide.spec.ts`) | Passed. Every sitemap page: 200, one H1, self-canonical, not noindex, unique title and description of the right length, `og:image`, `og:url`, large card, valid JSON-LD, Organization on home and Article on guides, no invented ratings, all internal links 200 without a redirect |
| Production-configuration build, static crawl | 81 sitemap URLs, 0 issues; downloader pages and the Twitch page included; YouTube, Reddit and offline excluded |
| Full browser suite | 289 passed, 13 skipped |
| Unit tests | 196 passed |
| Lighthouse, local build (mobile, simulated throttling) | PDF Merger: perf 96, SEO 100, a11y 100, LCP 2.7 s, CLS 0. Merge-PDF guide: perf 98, SEO 100, a11y 100, LCP 2.2 s, CLS 0. TikTok page: perf 96, CLS 0; SEO 66 only because the test build has no downloader backend and marks downloader pages noindex (indexable in production) |

**Advertising and layout:** ad slots reserve their space and collapse after interaction, giving CLS 0 on every measured page. The isolated Adsterra setup is unchanged, and Monetag stays off.

## 7. Google Search Console (owner's steps)

I don't have access to your Search Console, so nothing has been submitted or verified.

1. **Add the property.** Go to search.google.com/search-console → Add property → **Domain** → `yonixtools.com`. A domain property covers https, http and www.
2. **Verify ownership.** Google shows a TXT record (`google-site-verification=…`); add it at Hostinger: DNS / Nameservers → Manage DNS → add a TXT record for `@`. That's a DNS change for you to make.
   - **Without DNS:** use a **URL-prefix** property `https://yonixtools.com/` with the HTML-tag method. Deploy with `GOOGLE_SITE_VERIFICATION=<the content value>`, and the tag is added to every page.
3. **Submit the sitemap.** Sitemaps → enter `sitemap.xml` → Submit. The status should become "Success" with the number of discovered URLs.
4. **Inspect and request indexing.** Paste a URL in the top bar (start with `/`, `/tools/`, `/pdf-merger/`, `/tiktok-downloader/`, `/instagram-downloader/` and `/guides/`), then **Test live URL**, then **Request indexing**. Only a handful per day are allowed, so prioritise.
5. **Monitor regularly:**
   - **Pages (indexing):** look for "Crawled – currently not indexed", "Duplicate", "Excluded by noindex". Only YouTube, Reddit and offline should be noindex.
   - **Sitemaps:** errors.
   - **Core Web Vitals:** field data appears once there's enough traffic.
   - **Performance:** queries, clicks, impressions, average position. Compare against the keyword map in §4.
   - **Security & Manual actions:** these should stay empty.

## 8. Bing Webmaster Tools (owner's steps)

1. Go to bing.com/webmasters and sign in. **Import from Google Search Console** is the quickest route: it copies the verified site and sitemap.
2. **Or add `https://yonixtools.com` manually** and verify with one of:
   - a DNS CNAME;
   - the meta tag: deploy with `BING_SITE_VERIFICATION=<the msvalidate.01 value>` (supported by this change).
3. **Sitemaps** → submit `https://yonixtools.com/sitemap.xml`. Bing also reads the `Sitemap:` line in robots.txt.
4. **Optional:** IndexNow lets you notify Bing and Yandex instantly when pages change. It needs a key file and a ping after each deploy. It isn't set up; it's a small follow-up if you want it.

**Plain-http redirect check** (run on any machine):
```bash
curl -sI http://yonixtools.com/ | head -3        # expect 301 to https://yonixtools.com/
curl -sI http://www.yonixtools.com/ | head -3    # expect 301 to https://...
```

## 9. Needs your approval or action

- **Deploying this change to production.**
- **Search Console and Bing verification** (DNS TXT/CNAME at Hostinger, or the meta-tag variables at deploy), and submitting the sitemap.
- **Reviewing the 2027 guide** by 30 June 2027 (a test will remind you).
- **Optional:** IndexNow.
