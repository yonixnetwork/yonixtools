# YoniXTools

A universal social media downloader and a collection of free online tools. Source for **yonixtools.com**.

> **Status: Phase 1 (redesign) on `feature/phase-1-redesign`.** The new site is not deployed.
> The current production site on Hostinger is untouched.

| Area | Status |
|---|---|
| New homepage, design system, light/dark mode, responsive layout | ✅ Done |
| Tool registry, search with synonyms and typo tolerance, related tools | ✅ Done |
| 28 browser-based tools (QR, image, SEO, developer, text, calculators) | ✅ Working, tested |
| SEO landing pages (36), sitemap, robots.txt, JSON-LD, canonical URLs | ✅ Done |
| Universal downloader **interface** and platform detection | ✅ Done |
| Downloader **backend** (yt-dlp / gallery-dl / FFmpeg extraction) | ⏳ Phase 2: the UI says plainly that downloading is not live |
| DigitalOcean deployment | ⏳ Phase 8, after the server audit (`scripts/do-audit.sh`) |

## Repository layout

```
apps/web/                 Next.js 16 static site (all pages pre-rendered)
  src/lib/registry/       Tool registry: single source for pages, search, sitemap, JSON-LD
  src/lib/search.ts       Internal search engine
  src/lib/downloader/     URL detection + typed client for the downloader API
  src/lib/tools/          Pure tool logic (unit-tested)
  src/components/tools/   Tool UIs, lazy-loaded per category
  tests/unit/             Vitest
  tests/e2e/              Playwright, run against the real static build
docs/                     Audit, API contract, phase reports
scripts/do-audit.sh       Read-only DigitalOcean server audit (Phase 0)
```

The downloader backend will live in `services/downloader/` (Phase 2), separate from the frontend. The
frontend talks to it only over HTTPS, using the contract in [`docs/DOWNLOADER_API.md`](docs/DOWNLOADER_API.md).

## Develop

```bash
cd apps/web
npm install          # .npmrc sets legacy-peer-deps (npm 10 resolver bug)
cp .env.example .env.local
npm run dev          # http://localhost:3000
```

## Test

```bash
npm run typecheck
npm test             # unit tests (registry, search, URL detection, API client, tool logic)
npm run build        # static export to apps/web/out
npm run test:e2e     # Playwright against `out/`: every tool page, search, downloader states, mobile
```

## Build output

`npm run build` writes a fully static site to `apps/web/out/` (`/slug/index.html` for each page). Any static
web server can host it. Nginx config and deployment docs arrive with Phase 8.

## Adding a tool

1. Add an entry to `src/lib/registry/tools.ts` (slug, copy, keywords, synonyms, FAQs, related tools).
2. Implement the UI in the matching `src/components/tools/*Tools.tsx` (logic in `src/lib/tools/`, with tests).
3. Register it in `src/components/tools/registry.tsx` and `slugs.ts`.

The landing page, search entry, sitemap entry, breadcrumbs and structured data are generated
automatically. The registry test fails if a live tool has no UI, or if its metadata is missing or duplicated.

## Environment variables

See `apps/web/.env.example`. Nothing secret is used by the frontend. Never commit `.env` files.
