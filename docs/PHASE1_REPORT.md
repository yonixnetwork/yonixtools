# Phase 1 — Redesign (2026-11-06)

Branch: `feature/phase-1-redesign`. Nothing was deployed. DigitalOcean and the Hostinger production site were not touched.

## Built

- **Stack:** Next.js 16.4.3 static export, React 19, TypeScript. No CSS framework: a token-based design system
  (`apps/web/src/app/globals.css`) with a neutral scale, one indigo accent, the Inter variable font (self-hosted
  via npm), and light/dark themes (system default plus a stored toggle, without a theme flash).
- **Homepage:** navigation with search, hero with the universal downloader, platform shortcuts, popular tools,
  categories, recently added, recently used and recommended (on-device history, otherwise editor's picks),
  "why YoniXTools", FAQ and footer.
- **Universal downloader UI:** one input, live platform and content-type detection (Instagram, TikTok, YouTube,
  Facebook, X, Pinterest, Reddit, Vimeo), unsafe-URL rejection, and clear messages for unsupported content
  (Stories, profiles, playlists). It has a typed API client and a job-polling flow, ready for Phase 2. **Without
  a backend it states that downloading is not live and never reports success.**
- **Registry:** 36 tools, 7 categories, and 14 planned tools (planned tools have no pages; search says they
  are "planned").
- **Search:** field-weighted index with synonyms, prefix matching and typo tolerance (Damerau-Levenshtein),
  category intent, planned-tool awareness, header combobox (keyboard and `/` shortcut, lazy-loaded index),
  and an `/tools/` explorer with query string, category filters and empty state.
- **28 working browser tools:** QR (URL, Wi-Fi, vCard), image (compress, resize, convert), SEO (meta tags, SERP
  preview, robots.txt, slugs), developer (JSON, Base64, URL, UUID v4/v7, JWT, SHA hashes, regex), text (word
  counter, case, password, lorem ipsum, diff), calculators (percentage, age, BMI, loan, compound interest, units).
- **SEO:** a static page per tool with a unique title and description, one H1, H2 sections, steps, features,
  FAQ, related tools and breadcrumbs. Each page has a canonical URL, Open Graph and Twitter tags, and
  WebApplication, BreadcrumbList and FAQPage JSON-LD, plus WebSite and SearchAction on the homepage.
  Sitemap and robots.txt are generated, and Search Console verification is available via an env var.
  Downloader pages are `noindex` and kept out of the sitemap until the backend is live.

## Performance

About 155 KB gzipped initial JS per page, mostly the React and Next runtime (a further 39 KB polyfill chunk is
`noModule` and is skipped by modern browsers). Tool code is split per category and lazy-loaded. The search index
loads only on first interaction. HTML is 9–22 KB gzipped.

## Not done in Phase 1 (honest list)

- Downloader backend and real extraction (Phase 2). Instagram and YouTube repair cannot be tested from this
  sandbox, because the platform hosts are blocked by its network policy.
- PDF tools, image cropper, background remover, QR scanner, minifiers, sitemap/schema/OG/keyword tools (Phase 3).
- Open Graph share images, and a privacy page with final downloader retention periods.
- Keyword-demand research with real search data (no access to keyword tools from here).
- Lighthouse and Core Web Vitals measurements on real hosting.
