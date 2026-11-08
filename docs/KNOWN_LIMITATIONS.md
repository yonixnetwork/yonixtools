# Known limitations

## Platforms (verified live, 8 November 2026)

Real-platform results come from the live platform matrix and the live browser run (real extraction and download from a cloud IP). Details are in [PLATFORM_DIAGNOSTICS.md](PLATFORM_DIAGNOSTICS.md) and [TEST_MATRIX.md](TEST_MATRIX.md).

- **Working:**
  - TikTok, Instagram (reels, videos, single images, carousels, mixed posts), Facebook, X, Pinterest;
  - Dailymotion, Twitch clips, SoundCloud, Bluesky, Streamable;
  - new: LinkedIn, Kick clips, Medal, Mixcloud, 9GAG.
- **Imgur:** works from GitHub's IPs, but answers the production droplet with HTTP 429, so it is not advertised.
- **YouTube: not offered.** It was removed from the interface (8 November 2026); the backend adapter is kept, and re-enabling is described in `detect.ts`. Evidence follows.
- **YouTube evidence: blocked by platform.** "Sign in to confirm you're not a bot" from datacenter IPs, for every player client, with or without Deno, and **with PO tokens** (bgutil). Check the droplet with `deploy/scripts/diagnose-platforms.sh youtube`. A DigitalOcean IPv6 address is the remaining legitimate thing to try.
- **Reddit and Vimeo:** refused up front with the reason, and hidden from the interface. Reddit returns 403 to datacenter IPs; Vimeo requires an account or sends DRM streams.
- **Not added (failed live):** Threads (no extractor), Tumblr, Bandcamp, Rumble, Flickr, Audiomack, Loom, TED (download not verified), Snapchat.
- **Instagram image sizes:** logged out, Instagram serves one copy per image, so only "Original" is offered (plus JPG/PNG/WebP conversion). No other sizes are invented.
- **Individual posts can still fail:** login-only Facebook videos, region-locked TikTok posts, private or deleted content, and Instagram rate limits under heavy use.
- **Collections:** playlists, profiles and channels aren't downloaded. Multi-item *posts* (carousels, albums, multi-video tweets) are.
- The matrix runs from GitHub's IPs, not the droplet's, so results may differ in either direction. Run `diagnose-platforms.sh` after each deploy.
- **No cookies, accounts, or paid or residential proxies are used**, by design.

## Direct download

- The page confirms "Download started" only when the file response's one-time cookie arrives, which proves the browser received the response headers. This works only when the API is same-origin, as in production (`/api`). Otherwise, and in browsers that hide download responses, the page says "Download requested" and offers a manual "Save it here" link. It never claims success without evidence.
- iOS Safari saves to Files → Downloads. Automated tests cover Chromium desktop, Pixel 7 emulation (including live downloads from real platforms) and WebKit (iPhone emulation) in CI. No physical phone was tested.
- ZIP downloads contain the best copy of each selected item and are capped at the per-download size limit.
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


## Advertising

- **Delivery not confirmed from a server.** Adsterra answers datacenter IPs with HTTP 403, so real delivery wasn't observed by automated tests. Use `/ads-check/` on a real phone after deploying.
- **Isolation and Adsterra's terms.** Ad frames run on the site's own origin (`allow-same-origin`), because Adsterra's code throws in an opaque-origin sandbox (measured on the live site). The frames still can't navigate the page, and pages keep a strict CSP, but the ad code could read the page it is embedded in (as with any directly embedded ad tag). Full isolation with working ads needs the frame on a separate subdomain (e.g. `ads.yonixtools.com`), which needs a DNS record and your approval. Adsterra's terms forbid altering ad tags without consent; the tags are unaltered but framed, so confirm with Adsterra.
- **Ad delivery is not verified from automation.** Ad servers treat datacenter and automated browsers differently; real delivery must be confirmed on real devices with `/ads-check/`.
- **No consent banner** for EU/UK ad cookies.
- **Native banner height** varies. 280 px is reserved, and the frame resizes to the ad's real height once it renders.

## PWA

- The install prompt, home-screen icon, shortcuts and iOS Add to Home Screen were not tried on physical devices. Chromium's installability check passes, and the flows were tested by emulation.
- iOS Safari offers no install prompt, so iPhone users get a guide instead.
