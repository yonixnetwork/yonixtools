# YoniXTools

A universal social media downloader and 44 free browser-based tools. Source for **yonixtools.com**.

> **Status:** release candidate on `feature/phase-1-redesign`, **not deployed**. The current site on Hostinger is untouched.
> Production deployment needs your approval. See [docs/RELEASE_REPORT.md](docs/RELEASE_REPORT.md).

## What's inside

| | |
|---|---|
| **Universal downloader** | One link box. The backend detects Instagram, TikTok, YouTube, Facebook, X, Pinterest, Reddit or Vimeo and lists the formats; download jobs show live progress. Self-hosted yt-dlp, gallery-dl and FFmpeg. Public content only. |
| **44 browser tools** | PDF (merge, split, compress, to image, from images, rotate), image (compress, resize, convert, crop), QR (generate, Wi-Fi, vCard, scan), developer (JSON, Base64, URL, UUID, JWT, hashes, regex, HTML/CSS/JS minifiers), SEO (meta tags, SERP preview, robots.txt, slugs, sitemap, schema, Open Graph preview, keyword ideas, title ideas), text (word counter, case, passwords, lorem ipsum, diff), calculators (percentage, age, BMI, loan, compound interest, units). Files never leave the device. |
| **Discovery** | Search that understands synonyms and typos, categories, related tools, recently used tools. |
| **SEO** | A static page per tool with unique metadata, FAQs, breadcrumbs and JSON-LD; sitemap; robots.txt. |

## Repository

```
apps/web/              Next.js 16 static site
services/downloader/   FastAPI downloader (adapters, worker isolation, job queue)
deploy/                docker-compose, Nginx configs, preflight/deploy/smoke-test scripts
docs/                  Architecture, API, deployment, testing, security, limitations, reports
scripts/do-audit.sh    Read-only DigitalOcean server audit
```

## Quick start (development)

```bash
# Downloader API
cd services/downloader && python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
APP_ENV=development TEMP_ROOT=/tmp/ytx MIN_FREE_DISK_MB=100 uvicorn app.asgi:app --port 8787

# Website (second terminal)
cd apps/web && npm install && cp .env.example .env.local
echo "NEXT_PUBLIC_DOWNLOADER_API_URL=http://localhost:8787" >> .env.local
npm run dev    # http://localhost:3000  (the API allows this origin by default)
```

Requires Node 22, Python 3.12+ and FFmpeg.

## Tests

See [docs/TESTING.md](docs/TESTING.md). In short:
- `npm test`, `npm run test:e2e` and `npm run test:e2e:integrated` in `apps/web`
- `pytest` in `services/downloader`

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Downloader API](docs/DOWNLOADER_API.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Migration from YonixAlpha](docs/MIGRATION_FROM_YONIXALPHA.md)
- [Testing](docs/TESTING.md)
- [Security](docs/SECURITY.md)
- [Known limitations](docs/KNOWN_LIMITATIONS.md)
- [Release report](docs/RELEASE_REPORT.md)
- [Phase 0 audit](docs/PHASE0_AUDIT.md)

## Adding a tool

1. Add an entry in `apps/web/src/lib/registry/` (copy, keywords, synonyms, FAQs, related tools).
2. Put the logic in `src/lib/tools/` (with unit tests) and the UI in `src/components/tools/`.
3. Register it in `components/tools/registry.tsx` and `slugs.ts`.

The page, search entry, sitemap entry and structured data are generated automatically.

Never commit `.env` files or credentials.
