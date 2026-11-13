# Media extraction research and chosen architecture (November 2026)

This covers the candidates examined for the media expansion, what each offers, and why it was chosen or rejected.

Every claim marked **(live)** was checked with real requests from a cloud server in the live platform matrix; see [PLATFORM_DIAGNOSTICS.md](PLATFORM_DIAGNOSTICS.md).

## Candidates

| Project | License | Maintenance | What it adds for us | Decision |
|---|---|---|---|---|
| **yt-dlp** (2026.10.26) | Unlicense (public domain) | Very active: frequent releases, fast extractor fixes | 1,800+ extractors; Instagram carousels including image entries; DASH/HLS; FFmpeg integration; JS-challenge solving through Deno + `yt-dlp-ejs`; TLS impersonation through `curl_cffi` | **Primary engine** for every platform |
| youtube-dl | Unlicense | Effectively dormant (no regular releases since 2021) | Nothing yt-dlp lacks; misses years of fixes | Comparison only; rejected |
| **gallery-dl** (1.32.19) | GPL-2.0 | Active | Image and gallery sites (Pinterest images, X photos, Imgur albums, Bluesky) | **Fallback** for image posts. Runs as a separate program, never imported, to keep license boundaries clear |
| Cobalt (imputnet) | AGPL-3.0 (API) | Active, self-hostable Node service | A polished API over a similar set of sites. Its own docs recommend cookies for YouTube on server IPs, so the YouTube IP restriction is the same | Rejected. Using a public instance would send user URLs to a third party, which the rules forbid. Self-hosting adds a second service with AGPL obligations and no capability we lack |
| MeTube | AGPL-3.0 | Active | A web UI and queue on top of yt-dlp; no extraction of its own | Rejected: adds nothing to extraction |
| Instaloader | MIT | Active | Instagram profiles and posts. Anonymous access gets HTTP 401 "Please wait a few minutes" quickly; logged-in use risks account bans (issue tracker) | Rejected. yt-dlp already returns every carousel item anonymously **(live)**, and logins are excluded |
| **FFmpeg / FFprobe** (Debian package) | LGPL/GPL build | Active | Merging separate video and audio, MP3 extraction, image conversion (JPG/PNG/WebP) | **Used**. Only when needed: remux and merge, never re-encode video; convert only on request |
| **Deno + yt-dlp-ejs** | MIT / Unlicense | Active | Solves YouTube's player JavaScript challenges (required by yt-dlp since 2025) | **Used** (in the image since the previous upgrade) |
| **curl_cffi** | MIT | Active | Browser TLS fingerprints. Needed by yt-dlp for several sites, e.g. Bandcamp's challenge and Vimeo | **Used**, with a libcurl host pre-check plus a host egress firewall |
| bgutil-ytdlp-pot-provider | Open source (see its repository) | Active | Generates YouTube PO tokens locally (BotGuard) | Tested **(live)**: does **not** pass YouTube's bot check from datacenter IPs. Not deployed |
| FxTwitter API | External service | Active | X media without login | Rejected: it would send user URLs to a third party, and yt-dlp plus gallery-dl already cover X **(live)** |

## YouTube: root cause

1. **Fixed earlier:** v1.0 had no JavaScript runtime. Without Deno and `yt-dlp-ejs`, current yt-dlp gets no usable YouTube formats.
2. **Remaining cause: IP reputation.** From datacenter IPs YouTube answers "Sign in to confirm you're not a bot". Tested **(live)**:
   - the default client, `tv`, `tv_simply`, `web_embedded`, `web_safari`, `mweb`, `android_vr` and `ios`;
   - with and without Deno;
   - with PO tokens from bgutil (default, `mweb` and `web_safari` clients).

   All failed with the same message. This matches the yt-dlp PO Token Guide and bgutil's documentation: a PO token does not get around IP-based login restrictions, and datacenter IPs additionally need cookies.
3. Not the cause: FFmpeg, FFprobe, merging, timeouts, SABR or HTTP 403s on media. The request is refused before any format is returned.

**What the app does:**
- It uses the maintained engine with the full dependency set (yt-dlp, Deno, yt-dlp-ejs, curl_cffi, FFmpeg).
- It never shows invented qualities.
- When YouTube refuses the server, the user sees an accurate explanation.

**What could still make YouTube work** (to test on the droplet):

| Option | Allowed? | How |
|---|---|---|
| The droplet's own IP may not be challenged; the matrix runs from GitHub's IPs | Yes | `bash deploy/scripts/diagnose-platforms.sh youtube` |
| An IPv6 address on the droplet (DigitalOcean offers one free) | Yes | Enable IPv6 on the droplet, then run the diagnosis again |
| Cookies from a logged-in account, or residential or paid proxies | No (excluded by the project rules) | n/a |

## Chosen architecture

```
URL ─▶ validation + platform allowlist (platforms.py)
        unavailable platforms (Reddit, Vimeo) refused up front, with the reason
     ─▶ isolated worker process (socket guard, rlimits, timeouts)
        ─▶ backend chain per platform: yt-dlp ─(recoverable errors only)─▶ gallery-dl
        ─▶ normalized MediaInfo: mediaType, items[kind, preview, width×height, formats], sources
     ─▶ browser renders by media type
        ─▶ one-click job ─▶ worker download:
             · video/audio: yt-dlp (merge or remux with FFmpeg; MP3 only on request)
             · images: the exact source URL found during extraction
               (https only, size-capped; FFmpeg conversion only on request)
             · ZIP: selected items in one archive (stored, size-capped)
        ─▶ streamed attachment ─▶ browser download confirmed by cookie
```

**Fallback rules:**
- At most 2 backends per platform.
- Only recoverable errors (`no_media`, `extractor_failed`, `unsupported_content`) move on to the next backend.
- Permanent errors are never retried: private, login required, DRM, unsupported, too large.
- Each worker has a timeout, CPU and file-size limits, and a deadline watchdog.
- Duplicate requests reuse the running job.
- Concurrency and per-client caps, plus storage checks, bound resource use.

## Sources

- yt-dlp: [repository](https://github.com/yt-dlp/yt-dlp), [PO Token Guide](https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide), [issue #15796 (bot check with a PO token provider loaded)](https://github.com/yt-dlp/yt-dlp/issues/15796), [Threads extractor PR #9852 (not merged into releases)](https://github.com/yt-dlp/yt-dlp/pull/9852)
- bgutil-ytdlp-pot-provider: [repository](https://github.com/Brainicism/bgutil-ytdlp-pot-provider), [PyPI (notes on datacenter IPs and cookies)](https://pypi.org/project/bgutil-ytdlp-pot-provider/), [Docker image](https://hub.docker.com/r/brainicism/bgutil-ytdlp-pot-provider)
- gallery-dl: [repository and test fixtures](https://github.com/mikf/gallery-dl)
- Cobalt: [project listing (AGPL-3.0)](https://awesome.ecosyste.ms/projects/github.com%2Fimputnet%2Fcobalt), [self-host notes on YouTube rate limits and cookies](https://railway.com/deploy/cobalt-tools-updated-nov-26--cobalt-tools-setup)
- Instaloader: [issue #1411](https://github.com/instaloader/instaloader/issues/1411), [issue tracker (401 "please wait" reports)](https://issues.ecosyste.ms/hosts/GitHub/repositories/instaloader%2Finstaloader/issues)
- Sample posts for testing were taken from yt-dlp's `_TESTS` and gallery-dl's `test/results` upstream fixtures.
