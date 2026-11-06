# Known limitations

## Not verified against real platforms (blocker: network access)

The build environment cannot reach any social platform: DNS for youtube.com, instagram.com, tiktok.com, etc. is blocked by its network policy, and a request to allow those hosts was rejected by the environment service. Therefore:

- **No platform adapter has been verified end-to-end against a real post.** `services/downloader/live-results.json` records the attempt: YouTube and Vimeo failed at DNS resolution, and the others had no sample URL.
- What *is* verified:
  - URL classification for every platform.
  - Exact extractor selection.
  - The full pipeline (real worker → yt-dlp → native HLS → FFmpeg → file delivery), against a local HTTP server.
  - The complete API, queue and file-delivery flow, plus the frontend integration (with the platform step simulated).
- Run the live suite from the server before launch. It is opt-in and writes `live-results.json`:
  ```bash
  RUN_LIVE_TESTS=1 LIVE_URL_INSTAGRAM_REEL=… LIVE_URL_TIKTOK_VIDEO=… pytest tests/test_live.py
  ```
- The same applies to the legacy Instagram downloader on Hostinger. Its source isn't in any repository, so its failure could not be inspected. The new implementation replaces it.

## Expected platform behaviour (from yt-dlp/gallery-dl upstream, not tested here)

- **Instagram** often rate-limits or requires login for datacenter IPs. Public Reels/posts may intermittently return `login_required`/`platform_blocked`. Image posts depend on the gallery-dl fallback, which may also need login on some posts. **No cookie or login support will be added** (by design).
- **YouTube** increasingly challenges datacenter IPs ("confirm you're not a bot"). This surfaces as `platform_blocked`.
- **TikTok photo posts** rely on gallery-dl support, which is less mature than video support.
- Platforms change frequently, so keeping `yt-dlp` updated is the main maintenance task.

## Product scope

- **Background remover: not built.** No reliable, permissively licensed in-browser model was found. The best-known library is AGPL-3.0, and server-side removal would add significant CPU/RAM cost. Search reports it as planned.
- The **Keyword Idea Generator** is pattern-based and shows no search-volume data (stated on the page).
- The **Open Graph preview** reads pasted HTML. It deliberately does not fetch URLs, to avoid a second SSRF surface.
- **Strong PDF compression** rasterises pages, so text is no longer selectable (stated in the UI).
- **HEIC** images open only in browsers that can decode them (Safari).
- Very large files (PDFs over 200 MB, images over 50 megapixels) are refused to protect browser memory.

## Architecture

- Downloader job state is **in memory**: one process, and in-flight jobs are lost on restart (files are purged; clients see an error). Horizontal scaling would need a shared store (e.g. Redis) and shared temporary storage.
- Rate limits are per process and per IP. Clients behind a large shared NAT share a budget.
- No analytics, so "trending" tools are not shown. "Recommended" uses on-device history or editor's picks.
- No social share images (`og:image`) for pages yet.
- Lighthouse mobile LCP is about 2.4–2.6s (simulated slow 4G), right at Google's 2.5s "good" threshold. Most of it is the React/Next runtime (about 155 KB gzipped).

## Deployment

- Not deployed. The DigitalOcean server was never accessed from this environment, so its real resources, containers and ports are unknown until `scripts/do-audit.sh` is run.
- The Docker images were not built here (no Docker daemon in the sandbox). CI builds them on GitHub.
- The edge proxy choice (inside YonixAlpha's Nginx or a host Nginx) needs your decision.
