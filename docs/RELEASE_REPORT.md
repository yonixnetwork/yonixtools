# Release report: YoniXTools release candidate (2026-11-06)

Branch `feature/phase-1-redesign`. **Not deployed.** Hostinger and DigitalOcean were untouched.

## Verification levels

Each feature below is marked with the strongest level it reached:

- **E2E** – exercised end to end in a real browser and/or the real HTTP stack.
- **Auto** – covered by automated tests.
- **Impl** – implemented only.
- **Not verified** – an external blocker prevented any check.

| Feature | Level |
|---|---|
| Homepage, navigation, categories, footer, light/dark, responsive | E2E (desktop + Pixel 7/iPhone 15; no horizontal scroll) |
| 44 browser tools | E2E, each with real input (real PDFs, PNGs, QR images) |
| Search: names, synonyms, typos, categories, planned tools, suggestions, empty state | Auto + E2E |
| SEO: 67 static pages, unique titles/descriptions, canonical, OG, JSON-LD, sitemap, robots | E2E on every tool page |
| Downloader UI ↔ API: formats, job progress, file delivery, error states | E2E against the real API (platform step simulated) |
| Downloader pipeline: worker → yt-dlp → native HLS → FFmpeg → file | Auto, real tools against a local media server |
| Security controls (SSRF, redirects, rebinding, injection, traversal, limits) | Auto (see SECURITY.md) |
| Production Nginx (edge TLS + stack + API) | E2E in the sandbox: `nginx -t` on all configs, 28/28 smoke checks, browser run under the production CSP with 0 violations |
| Docker images / compose | Impl. `docker compose config` is valid; images build in CI (no Docker daemon in the sandbox) |
| **Real social-platform extraction** | **Not verified.** Platform hosts are blocked in this sandbox (DNS fails); the network-access request was rejected. See KNOWN_LIMITATIONS.md |

## Downloader platforms

| Platform | Content types implemented | Verified against real posts |
|---|---|---|
| Instagram | Reels, video posts, image posts, carousels (gallery-dl fallback for images) | No |
| TikTok | Videos, photo posts (gallery-dl), vm/vt short links | No |
| YouTube | Videos, Shorts, youtu.be, /live, /embed | No (DNS blocked) |
| Facebook | Videos, Reels, fb.watch, share links | No |
| X / Twitter | Post videos, GIFs, images (gallery-dl) | No |
| Pinterest | Video and image pins, pin.it | No |
| Reddit | Videos (with audio merged), images/galleries, redd.it | No |
| Vimeo | Videos | No (DNS blocked) |

Unsupported, with explicit messages: Instagram Stories and profiles, YouTube playlists, TikTok profiles, private, login-only, age-restricted, DRM and live content.

## Test results (final run from a clean install)

| Suite | Passed | Failed | Skipped |
|---|---|---|---|
| Downloader pytest (unit, security, API integration, real pipeline, load) | 184 | 0 | 12 (opt-in live tests) |
| Live platform tests (separate run) | 0 | 2 (YouTube, Vimeo: DNS blocked) | 10 (no sample URLs) |
| Website unit (Vitest) | 130 | 0 | 0 |
| Website e2e (Playwright, desktop + mobile) | 95 | 0 | 0 |
| Integrated e2e (website + real API) | 6 | 0 | 0 |
| Production-chain smoke test (edge TLS → Nginx → API) | 28 | 0 | 0 |
| Browser run under production CSP | 11 | 0 | 0 (0 CSP violations) |
| npm audit / pip-audit | 0 vulnerabilities / none known | | |
| shellcheck (all scripts) | no warnings | | |

## Performance

Lighthouse 12.8.2, mobile, simulated slow 4G, gzip as in production:

| Page | Perf | A11y | Best practices | SEO | FCP | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|---|
| / | 97 | 100 | 100 | 100 | 1.2 s | 2.6 s | 80 ms | 0 |
| /pdf-merger/ | 95 | 100 | 100 | 100 | 1.2 s | 2.5 s | 170 ms | 0 |
| /json-formatter/ | 97 | 100 | 100 | 100 | 1.2 s | 2.4 s | 100 ms | 0 |
| /image-compressor/ | 98 | 100 | 100 | 100 | 1.2 s | 2.4 s | 30 ms | 0 |

Backend under load: 24 jobs with 2 concurrent workers completed in 2.3 s (simulated platform). Peak running was 2 (the limit held). API memory grew by 1 MB. Queue overflow returns 503 instead of buffering.

## Acceptance checklist

- [x] Professional homepage completed
- [x] Responsive layouts verified
- [x] Universal downloader implemented and integrated
- [ ] **Supported platform adapters tested against real platforms: blocked (no network access to the platforms)**
- [x] Utility library implemented (44 tools; background remover deliberately not built)
- [x] Tool search and discovery working
- [x] All navigation and links working
- [x] SEO pages and metadata implemented
- [x] Sitemap and robots.txt verified
- [x] Backend integrated
- [x] Security checks completed
- [x] Unit tests passed
- [x] Integration tests passed
- [x] End-to-end tests passed
- [x] Production build successful
- [x] Performance checks completed
- [x] Error handling verified
- [x] Documentation completed
- [x] All source changes pushed to GitHub
- [x] Deployment configuration prepared
- [x] DigitalOcean deployment safety reviewed (preflight is read-only; isolated compose project; nothing applied)
- [x] No unapproved production changes made

## Deployment readiness

**Ready for a staged deployment, not yet for launch.** Launch requires:

1. The server audit (`scripts/do-audit.sh`) and a verified YonixAlpha backup.
2. Live verification of the platform adapters from the server (`tests/test_live.py` with real sample URLs). Datacenter IPs are often blocked by Instagram and YouTube, so this is the main risk.

## Waiting on your approval

1. Running the audit and backup on the DigitalOcean droplet.
2. The edge proxy choice (inside YonixAlpha's Nginx, or a host Nginx after retiring it), plus any server resize.
3. The first deploy (`deploy/scripts/deploy.sh`), the DNS switch, and certificate issuance.
4. Any change to YonixAlpha services, and the eventual Hostinger cancellation.
5. Merging this branch (a pull request can be opened on request).
