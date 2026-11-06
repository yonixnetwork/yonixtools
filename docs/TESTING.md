# Testing

| Suite | Command | What it covers |
|---|---|---|
| Frontend unit (Vitest) | `cd apps/web && npm test` | Registry integrity, search (names, synonyms, typos, categories, planned tools), URL detection, API client (never false success), all tool logic (text, encoding, JSON, JWT, hashes, passwords, UUIDs, calculators, units, QR payloads, meta tags, robots.txt, regex, PDF merge/split/rotate/optimise/images, QR decoding, crop maths, sitemap, schema, OG parsing, minifiers) |
| Frontend e2e (Playwright) | `npm run build && npm run test:e2e` | Every tool page (status, single H1, unique title, description, canonical, OG, robots, JSON-LD, breadcrumbs, related tools, no console errors); real interactions with real files for every tool; search and discovery; downloader states without a backend; theme; mobile layouts (no horizontal scroll) and menu |
| Integrated e2e | `npm run build:integrated && npm run test:e2e:integrated` | A second static build wired to the **real downloader API**. Format listing, job progress, file delivery, extractor and job errors, carousels, client-side unsafe-URL rejection, indexability once the backend exists. The platform step is simulated by `services/downloader/tests/fake_worker.py` |
| Backend (pytest) | `cd services/downloader && pytest` | Platforms, SSRF guard, resolver, extractor mapping and selection, error classification, adapter fallback, rate limiter, API integration (full job lifecycle with a real MP4 checked by ffprobe, validation, caps, timeouts, expiry, cleanup, restart purge, path traversal, CORS, proxy headers), **real yt-dlp + FFmpeg pipeline** against a local server (direct MP4, HLS, size limit, socket guard, tampered requests, watchdog), load (24 jobs at concurrency 2, queue overflow) |
| Live platforms | `RUN_LIVE_TESTS=1 LIVE_URL_…=… pytest tests/test_live.py` | Real public posts through the production worker. **Not runnable in the build sandbox** (see KNOWN_LIMITATIONS.md) |
| Smoke test | `deploy/scripts/smoke-test.sh <base-url>` | Post-deploy checks of pages, headers, caching, API health, unsafe and oversized input, and optionally a real download |
| Audits | `npm audit`, `pip-audit -r requirements.txt`, `shellcheck` | Dependencies and scripts |

CI (`.github/workflows/ci.yml`) runs all of these except the live and smoke suites, and also builds both Docker images.
