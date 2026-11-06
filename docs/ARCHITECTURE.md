# Architecture

```
Browser ──HTTPS──▶ Edge proxy (TLS, HSTS, 80→443)          [server-level; see DEPLOYMENT.md]
                     │  127.0.0.1:8090
                     ▼
              ┌───────────── compose project "yonixtools" ─────────────┐
              │  web  (nginx:1.27-alpine, read-only)                    │
              │   • static site (apps/web/out): 67 pre-rendered pages   │
              │   • CSP + security headers, gzip, immutable assets      │
              │   • /api/* ──▶ downloader:8787 (rate-limited, no /internal)
              │                                                         │
              │  downloader  (python:3.12-slim, non-root, read-only,    │
              │               cap_drop ALL, mem 1 GB)                   │
              │   FastAPI ─▶ job queue ─▶ worker subprocesses           │
              │                           (yt-dlp / gallery-dl / FFmpeg)│
              │   temp volume: /var/lib/yonixtools/tmp (TTL-cleaned)    │
              └─────────────────────────────────────────────────────────┘
```

## Frontend: `apps/web`

- **Next.js 16, fully static export.** Every page is plain HTML: homepage, 52 tool pages, 8 categories, the tools index, privacy, 404, `sitemap.xml` and `robots.txt`. There's no Node server in production.
- **Tool registry** (`src/lib/registry/`): the single source for pages, navigation, search, related tools, the sitemap, breadcrumbs and JSON-LD. A unit test fails if a live tool has no UI, or if its metadata is duplicated or incomplete.
- **Tools:** 44 run entirely in the browser. Logic lives in `src/lib/tools/` and is unit-tested; UI lives in `src/components/tools/`, lazy-loaded per category chunk. Libraries: pdf-lib (MIT), pdf.js (Apache-2.0), jsQR (Apache-2.0), qrcode (MIT), Terser (BSD-2), csso (MIT), html-minifier-terser (MIT), fflate (MIT).
- **Search** (`src/lib/search.ts`): a field-weighted index with query synonyms, prefix and typo matching (Damerau-Levenshtein), category intent, and awareness of planned tools. The header search loads the index lazily on first focus.
- **Downloader UI** (`src/components/Downloader.tsx`): platform detection gives instant feedback (`src/lib/downloader/detect.ts`; the backend re-validates everything). A typed client (`client.ts`) never yields success without a well-formed backend response. Availability is decided at build time by `NEXT_PUBLIC_DOWNLOADER_API_URL`: without it, downloader pages say downloading isn't live, are `noindex`, and are left out of the sitemap.

## Downloader service: `services/downloader`

| Module | Role |
|---|---|
| `platforms.py` | Host allowlist and URL classification per platform; the exact yt-dlp extractor names allowed (never `generic`) |
| `netguard.py` | SSRF defence: public-IP checks plus a process-wide `getaddrinfo` guard (also applied inside workers, which defeats DNS rebinding) |
| `resolver.py` | Short-link resolution (pin.it, vm.tiktok.com, fb.watch, redd.it…) with every redirect hop validated |
| `adapters/chain.py` | Platform adapter = an ordered chain of backends. yt-dlp first; gallery-dl fallback for image posts (Instagram, X, Reddit, Pinterest, TikTok) |
| `adapters/ytdlp_backend.py` | Maps yt-dlp info to opaque format ids (`v:best`, `v:720`, `a:best`, `i:best`, …); fixed selectors only |
| `adapters/gallerydl_backend.py` | gallery-dl runs as a separate program (GPL-2.0; never imported) |
| `worker.py` | One operation per process: socket guard, rlimits (memory, file size, CPU, fds), its own process group, and a watchdog that kills the group if the API dies or a deadline passes |
| `runner.py` | Spawns workers with a scrubbed environment and a hard timeout (kills the process group) |
| `service.py` | Extraction cache, bounded job queue (global and per-client caps), storage guards, TTL cleanup, startup purge, per-extractor stats |
| `main.py` | HTTP layer: body size and content-type checks, rate limits, CORS, uniform JSON errors, security headers, `/healthz`, `/readyz`, loopback-only `/internal/stats` |

### Request flow

1. `POST /v1/extract {url}`: validate, resolve the short link if needed, then spawn a worker (`extract`), cache the result for 10 minutes, and return items with formats.
2. `POST /v1/jobs {url, itemIndex, formatId}`: the format must be one that extraction offered. The job is queued (202) under the concurrency and queue limits.
3. Job worker (`download`) writes `media.<ext>` into `TEMP_ROOT/<128-bit id>/`, streaming progress.
4. `GET /v1/jobs/{id}` is polled for progress. Once the job is `done`, `GET /v1/jobs/{id}/file` streams the file through Nginx without buffering.
5. Files expire after `FILE_TTL_SECONDS` (15 min). The cleanup loop removes expired files, forgets old jobs, and deletes orphaned directories.

### Why in-memory state

Jobs are short-lived and the server is small, so there's no Redis or database. Consequences, handled deliberately:
- Run **one** uvicorn process (the Dockerfile enforces this).
- A restart loses in-flight jobs. The startup purge deletes their files, and polling clients get `not_found`, which the UI shows as an error, never as success.

Scaling out would need a shared job store; see KNOWN_LIMITATIONS.md.

### Extending

- **New platform:** add a `Platform` in `platforms.py`, mirror its detection in `apps/web/src/lib/downloader/detect.ts`, and add a registry entry.
- **Swap an extractor for one platform:** change its chain in `adapters/chain.py`.
- **New browser tool:** add a registry entry, plus logic with tests and a UI component; then add it to `components/tools/registry.tsx` and `slugs.ts`.
