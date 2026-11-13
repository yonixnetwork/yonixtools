# Platform diagnostics

> **Update, media expansion (8 November 2026):** see "Media expansion results" at the end of this page.
> Reddit and Vimeo are now refused up front and hidden from the interface. Six platforms were added.

## Downloader reliability (7 November 2026)

How each platform was diagnosed, what was wrong, what changed, and what is still blocked.
Everything here comes from **real requests and real downloads**, not mocks.

## Method

- **Live platform matrix:** `.github/workflows/live-platforms.yml`, running `services/downloader/diagnostics/live_matrix.py` from GitHub-hosted runners (Azure datacenter IPs, the same class of IP as the DigitalOcean droplet). It runs for each platform and sample post:
  - `deployed`: the exact v1.0 code running on the droplet (commit `c1b070c`) with its original dependencies, so the root cause is reproduced, not assumed;
  - `full`: the upgraded dependencies plus Deno, the service's own worker (what users get), plain yt-dlp, yt-dlp without a JS runtime, and alternative methods (YouTube player clients, X syndication API, FxTwitter API, Facebook embed URL, Vimeo player URL, gallery-dl, Reddit JSON).
- **Result labels:**
  - `DOWNLOAD-OK`: metadata extracted **and** a file downloaded, with its size recorded;
  - `META-ONLY`: metadata extracted, but no download was attempted or it failed;
  - `FAIL`: exact error recorded.
- **From the droplet itself:** `bash deploy/scripts/diagnose-platforms.sh [platform] [your links…]` runs the same worker inside the production container. It uses the droplet's IP, sandbox and egress firewall.

Runs used: #2 (`cb2179f`), #3 (`fca99b1`), #4 (`e8f55ec`). Dates: 7 November 2026.

## Root causes found

| # | Root cause | Affected | Evidence |
|---|---|---|---|
| 1 | yt-dlp now needs a **JavaScript runtime (Deno) and `yt-dlp-ejs`** to solve YouTube's player challenges; v1.0 had neither. | YouTube (also affects formats on other sites) | yt-dlp source; `js_runtimes` default is Deno |
| 2 | **No TLS impersonation (`curl_cffi`)**: Vimeo returned "blocked due to its TLS fingerprint", and Reddit's session setup depends on it. | Vimeo, Reddit | yt-dlp source and error text |
| 3 | yt-dlp's **default Vimeo API client now requires a login** ("The web client only works when logged-in"). | Vimeo | runs #2 and #3, deployed and full |
| 4 | **YouTube blocks datacenter IPs**: "Sign in to confirm you're not a bot" for every client (web, tv, web_safari, mweb, android_vr, ios), with or without Deno. | YouTube | runs #2–#4 |
| 5 | **Reddit blocks anonymous datacenter traffic**: yt-dlp gets "Account authentication is required", and even `reddit.com/comments/<id>.json` returns **HTTP 403 Blocked** (plain and impersonated). | Reddit | runs #2–#4 |
| 6 | Some posts genuinely can't be read: a Facebook video that is limited to logged-in users ("Cannot parse data"), a TikTok post region-locked ("Your IP address is blocked from accessing this post"), and a 2016 X "Amplify" video whose host no longer exists. | individual posts | runs #2–#4 |
| 7 | Error messages were generic, so a platform block looked like a YoniXTools bug. | all | code review |
| 8 | The UI needed a second "Save file" click after preparation, and claimed nothing about whether the browser actually started the download. | all | code review |

TikTok, Instagram, Facebook, X and Pinterest **already worked in v1.0** from a datacenter IP (the deployed code downloaded real files in run #2).

## Per-platform result

| Platform | Status | Primary method | Fallback | Tested content |
|---|---|---|---|---|
| TikTok | Working | yt-dlp (`tiktok`), clean format preferred over watermarked | gallery-dl | video (1 of 2 samples region-locked) |
| Instagram | Working | yt-dlp (`instagram`) | gallery-dl (image/carousel posts) | Reel, photo post |
| Facebook | Working | yt-dlp (`facebook`, `facebook:reel`) | none (embed URL was tested and gives the same result) | public page videos (1 of 2 login-only) |
| X (Twitter) | Working | yt-dlp (`twitter`) | gallery-dl | GIF, video |
| Pinterest | Working | yt-dlp (`pinterest`) | gallery-dl (image pins) | image pin, video pin |
| Dailymotion | **New, working** | yt-dlp (`dailymotion`) | none | video |
| Twitch | **New, working** (clips only) | yt-dlp (`twitch:clips`) | none | clip |
| SoundCloud | **New, working** | yt-dlp (`soundcloud`), audio only | none | track |
| Bluesky | **New, working** | yt-dlp (`bluesky`) | none | video post |
| Streamable | **New, working** | yt-dlp (`streamable`) | none | video |
| Vimeo | Blocked by platform | yt-dlp API client (needs an account) | embed-player fallback **tried and removed**: it extracts metadata, but the streams are DRM-protected (run #4) and embed-restricted videos return 401 | 2 public videos |
| YouTube | Blocked by platform | yt-dlp + Deno + yt-dlp-ejs | none possible without accounts or proxies | 2 public videos, 6 client variants |
| Reddit | Blocked by platform | yt-dlp + curl_cffi | none possible (JSON API also 403) | 2 public video posts |
| Snapchat | Not offered | yt-dlp fails ("Unable to extract next.js data") | n/a | Spotlight |

## External services evaluated

- **FxTwitter API (api.fxtwitter.com):** it worked for X, but it would send every user's tweet URL to a third party and it adds nothing over the self-hosted chain (yt-dlp plus gallery-dl covers the same posts). **Not used.**
- **Paid proxies and cookie or account pools:** not used. This is the only realistic way to get YouTube and Reddit working from a server, and it conflicts with the requirements (no logins, no paid APIs, no bypassing access controls).

## Changes made

- **Docker image:**
  - ships Deno;
  - `yt-dlp[default,pin-curl-cffi]` pulls in yt-dlp-ejs and curl_cffi;
  - the address-space limit is off by default (V8 reserves large virtual memory).
- **Security for curl_cffi** (libcurl does its own DNS and redirects):
  - a host pre-check on every curl_cffi request;
  - a host egress firewall for the stack subnet (`deploy/scripts/egress-firewall.sh`), re-applied at boot;
  - CI proves internal targets are blocked while the internet works.
- **Fallback chain:**
  - DRM-flagged formats are removed before format selection on every platform;
  - the Vimeo embed-player fallback was built, tested live (runs #3 and #4) and removed, because it listed qualities that could never download.
- **New platforms, backend and frontend:** Dailymotion, Twitch clips, SoundCloud, Bluesky, Streamable.
- **Platform-specific messages:** YouTube bot wall, Reddit refusal, Vimeo login wall, Facebook login-only, TikTok region lock, Instagram rate limit.
- **Format mapping:**
  - no YouTube storyboards;
  - "no watermark" only when a clean source really exists, otherwise labelled "watermarked";
  - duplicate qualities (same file) removed;
  - no invented resolutions.
- **Jobs:**
  - phases (queued, downloading, processing, ready);
  - identical requests reuse the running or finished job.
- **Download delivery:** `HEAD` support and a one-time `ytx_dl_<token>` cookie on the file response, so the page can confirm the browser really started receiving the file.

## Not fixable within the rules

- **YouTube:** works only from IPs YouTube doesn't challenge. Check the droplet with `bash deploy/scripts/diagnose-platforms.sh youtube`. If it reports the bot wall, YouTube stays "Blocked by platform".
- **Vimeo:** the API needs an account, and the embed player's streams are DRM-protected.
- **Reddit:** the same applies as for YouTube. Reddit's official API needs registered app credentials and has restrictive terms for downloading, so it was not added.

## How to update the status shown on the site

1. Run the matrix: push a commit whose message contains `[live-matrix]`, or use "Run workflow" on the Live platform matrix.
2. Also run `deploy/scripts/diagnose-platforms.sh` on the droplet.
3. Update `apps/web/src/lib/downloader/platform-status.ts` (state, note, `VERIFIED_ON`) only from that evidence.


## Media expansion results (live matrix runs 5–8, live browser run 12)

Regression baseline is the production code (`c259dfc`, `feature/downloader-reliability`). Every result comes from real posts, downloaded from GitHub-hosted (datacenter) IPs.

### Regression: previously working platforms

| Platform | Production code | Candidate code |
|---|---|---|
| TikTok | download OK (one sample region-locked in both) | download OK |
| Instagram reel / video posts | download OK | download OK; multi-video posts also as ZIP (3.5 MB, 5.2 MB) |
| Facebook | download OK (one login-only sample fails in both) | download OK |
| X | download OK | download OK; 4-video post as ZIP (0.9 MB) |
| Pinterest (image + video) | download OK | download OK |
| Dailymotion, Twitch, SoundCloud, Bluesky, Streamable | download OK | download OK |

### Fixed by this upgrade

| Content | Production code | Candidate code |
|---|---|---|
| Instagram single image | **FAIL** "There is no video in this post" | image item: 383 KB JPG, PNG conversion 4.0 MB |
| Instagram 5-image carousel | **FAIL** "No video formats found" | 5 image items: 192 KB JPG each item, PNG conversion, ZIP 527 KB |
| Instagram image fallback (gallery-dl) | 429 / timeout from datacenter IPs | no longer needed: yt-dlp returns every carousel item |

**Instagram image sizes.** Logged-out Instagram returns one display URL per image, with no list of alternative sizes. So images are offered as "Original" (plus the dimensions when known) with optional JPG/PNG/WebP conversion. No other sizes are invented.

### New platforms (worker extraction **and** real download verified)

| Platform | Content verified | Primary | Fallback |
|---|---|---|---|
| LinkedIn | public post video (8.6 MB) | yt-dlp `linkedin` | none |
| Kick | clip (51 MB) | yt-dlp `kick:clip(s)` | none |
| Medal | game clip | yt-dlp `medaltv` | none |
| Mixcloud | show audio (89 MB), original + MP3 | yt-dlp `mixcloud` | none |
| 9GAG | video post | yt-dlp `9gag` | none |
| Imgur | GIF post as MP4 (2.7 MB, live browser); album of 2 animated items (ZIP 783 KB) | yt-dlp `imgur*` (animated/video items) | gallery-dl (static images) |

**Imgur GIF classification fix (made after run 7).** A `.gif` entry plus MP4 copies is now a video, not an image. Verified in the final run (14): the GIF post downloads as MP4 in the browser. The sample album's items are animated, so they too are correctly reported as videos. yt-dlp only lists animated or video items of Imgur albums; static-image albums fall back to gallery-dl.

### Final verification (run 14, commit `6364c03`)

- All 31 jobs succeeded.
- Live browser: **11/11** passed. Since run 12, it adds Imgur GIF (2.7 MB MP4) and LinkedIn (8.6 MB MP4).
- No failure in the candidate code that the production code doesn't share for the same sample:
  - a region-locked TikTok post;
  - a login-only Facebook video;
  - a dead 2016 X "Amplify" video;
  - YouTube's bot check.

### Tested and not added

| Candidate | Result from datacenter IP |
|---|---|
| Threads | no extractor in yt-dlp or gallery-dl (only an unmerged yt-dlp PR) |
| Tumblr | yt-dlp connection dropped; gallery-dl "Daily API rate limit exceeded" (needs your own OAuth app) |
| Bandcamp | "Got client challenge webpage response" |
| Rumble | HTTP 403 |
| Flickr | HTTP 403 / 502 |
| Audiomack | "Failed to parse JSON" |
| Loom | "The downloaded file is empty" |
| TED | metadata only; download not verified |
| Snapchat | "Unable to extract next.js data" (runs 2–4) |

### Deliberately hidden

Reddit (HTTP 403 even on public JSON) and Vimeo (account required or DRM streams) are refused before any extraction, with the reason. They are not shown in the status list, navigation, search or sitemap. Their old pages stay reachable but are noindex.

### YouTube

Conclusive (runs 5–8):

- **Every method tried fails** with "Sign in to confirm you're not a bot":
  - 8 player clients (default, `tv`, `tv_simply`, `web_embedded`, `web_safari`, `mweb`, `android_vr`, `ios`);
  - with and without Deno;
  - with **PO tokens from the bgutil provider**.
- **Cause:** IP reputation; see [RESEARCH_MEDIA_EXTRACTION.md](RESEARCH_MEDIA_EXTRACTION.md#youtube-root-cause).
- **What users see:** the site shows the honest explanation (verified in the live browser run).

### Live browser journeys (run 12)

Real website, real worker, real platforms. Chromium emulating an Android phone (Pixel 7). Every step asserts a real file arrived in the browser:

| Journey | File received |
|---|---|
| TikTok | 780 KB MP4 |
| Instagram reel | 1.9 MB MP4 |
| Instagram carousel: image | 192 KB JPG |
| Instagram carousel: PNG conversion | 2.2 MB PNG |
| Instagram carousel: ZIP of 2 | 342 KB ZIP |
| Instagram single image | 383 KB JPG |
| SoundCloud MP3 | 3.4 MB |
| Facebook | 7.7 MB |
| Twitch clip | 16 MB |
| X 4-video ZIP | 1.2 MB |
| YouTube | honest error shown |

Result: **9/9 passed** (run 12), then **11/11** in the final run 14.


## Production droplet results (8 November 2026, `diagnose-platforms.sh` from the droplet's own IP)

**Downloads work for:**

- Instagram: reel, video post, single image, 5-image carousel, multi-video post;
- TikTok, X (GIF, video, multi-video), Pinterest (video and image);
- Dailymotion, Twitch, SoundCloud, Bluesky, Streamable;
- LinkedIn, Kick, Medal, 9GAG.

**Problems found, and what was done:**

| Platform | Result | Action |
|---|---|---|
| YouTube | "Sign in to confirm you're not a bot", the same as from GitHub | confirms the IP-reputation cause |
| Facebook | the CNN sample failed with "[Errno 101] Network is unreachable": an IPv6 connection attempt, and the Docker network has no IPv6 route | IPv4 is now forced (`YTX_IPV4_ONLY=1`, the image default). The login-only sample fails as everywhere |
| Imgur | HTTP 429 on every sample | Imgur refuses the droplet's IP. It is **no longer advertised**; links still work and show an honest error when refused |
| Mixcloud | a file-rename error during MP3 conversion (not seen on GitHub) | being investigated |
