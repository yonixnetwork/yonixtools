# Known limitations

## Platforms (verified live, 7 November 2026)

Real-platform results come from the live platform matrix: real extraction and download from a cloud IP. Details are in [PLATFORM_DIAGNOSTICS.md](PLATFORM_DIAGNOSTICS.md).

- **Working:** TikTok, Instagram, Facebook, X, Pinterest, Dailymotion, Twitch clips, SoundCloud, Bluesky, Streamable.
- **YouTube: blocked by platform.** "Sign in to confirm you're not a bot" from datacenter IPs, with every player client tried. Deno and yt-dlp-ejs are installed, so YouTube works if the server's IP is not challenged. Check the droplet with `deploy/scripts/diagnose-platforms.sh youtube`.
- **Reddit: blocked by platform.** Reddit returns 403 to anonymous datacenter requests, including its JSON endpoints.
- **Vimeo: blocked by platform.** The API needs an account, and the embed player's streams are DRM-protected.
- **Snapchat: not offered.** yt-dlp's extractor fails.
- **Individual posts can still fail:** login-only Facebook videos, region-locked TikTok posts, and private or deleted content.
- The matrix runs from GitHub's IPs, not the droplet's. The droplet's own results may differ in either direction, so run `diagnose-platforms.sh` after each deploy.
- **No cookies, accounts, or paid or residential proxies are used**, by design. Platforms change often, so keeping yt-dlp updated is the main maintenance task.

## Direct download

- The page confirms "Download started" only when the file response's one-time cookie arrives, which proves the browser received the response headers. This works only when the API is same-origin, as in production (`/api`). Otherwise, and in browsers that hide download responses, the page says "Download requested" and offers a manual "Save it here" link. It never claims success without evidence.
- iOS Safari saves to Files → Downloads. Automated tests cover Chromium desktop, Pixel 7 emulation and WebKit (iPhone emulation) in CI, not a physical iPhone.
- The video tools decode in the browser, so they handle only formats the browser can play (e.g. no H.264 in some Linux Chromium builds, HEVC mostly only in Safari).

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
