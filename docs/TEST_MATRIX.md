# Platform test matrix

Legend:
- **L**: verified live, with a real file downloaded from a real post: live matrix worker run, or live browser run (Pixel 7 emulation).
- **I**: integrated test (real API, queue and file delivery, with a simulated platform step).
- **U**: unit test.
- **n/a**: the platform doesn't have that content type.
- **—**: not supported.

| Platform | Valid URL | Invalid URL | Video | Audio | Single image | Carousel | Mixed | Quality choice | Item download | ZIP | Direct download | Errors | Fallback |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| TikTok | L | U | L | U (MP3 when audio is muxed) | — | — | — | L | L | — | L (browser) | L (region lock) | U (gallery-dl) |
| Instagram | L | U | L | U | L | L | I | L (video) / "Original" only (images: no other sizes served) | L | L | L (browser) | U | gallery-dl (rate-limited from datacenter IPs) |
| Facebook | L | U | L | U | n/a | n/a | n/a | L | L | — | L (browser) | L (login-only post) | none |
| X | L | U | L | U | — | L (multi-video) | — | L | L | L | L (browser) | U | gallery-dl (L) |
| Pinterest | L | U | L | — | L | — | — | L | L | — | I | U | gallery-dl (L) |
| Twitch (clips) | L | U | L | — | n/a | n/a | n/a | L | L | — | L (browser) | U | none |
| SoundCloud | L | U | n/a | L (original + MP3) | n/a | n/a | n/a | L | L | — | L (browser) | U | none |
| Dailymotion | L | U | L | U | n/a | n/a | n/a | L | L | — | I | U | none |
| Bluesky | L | U | L | U | — | — | — | L | L | — | I | U | gallery-dl (L) |
| Streamable | L | U | L | U | n/a | n/a | n/a | L | L | — | I | U | none |
| LinkedIn (new) | L | U | L | U | — | — | — | L | L | — | I | U | none |
| Kick clips (new) | L | U | L | — | n/a | n/a | n/a | L | L | — | I | U | none |
| Medal (new) | L | U | L | — | n/a | n/a | n/a | L | L | — | I | U | none |
| Mixcloud (new) | L | U | n/a | L (original + MP3) | n/a | n/a | n/a | L | L | — | I | U | none |
| 9GAG (new) | L | U | L | — | — | — | — | L | L | — | I | U | none |
| Imgur (new) | L | U | L (GIF as MP4, browser) | — | L* | L (album) | — | L | L | L | L (browser) | U | gallery-dl |
| YouTube | blocked | U | blocked by platform (IP bot check) | — | — | — | — | — | — | — | — | L (honest error) | none possible |
| Reddit, Vimeo | refused up front | U | — | — | — | — | — | — | — | — | — | U, I (refused, no API call) | — |

## Suites

| Suite | Count | Status |
|---|---|---|
| Backend `pytest` (incl. real yt-dlp/FFmpeg pipeline, SSRF, ZIP, previews) | 266 passed, 12 skipped (opt-in live tests) | passing |
| Web unit tests (`vitest`) | 169 | passing |
| Browser e2e: static site (desktop + Pixel 7) | 117 | passing |
| Browser e2e: integrated (real API, desktop + Pixel 7; WebKit iPhone in CI) | 22 (+ iPhone in CI) | passing |
| Live browser on real platforms (Pixel 7 emulation) | 11 | passing (final run 14) |
| Live platform matrix (production code vs candidate code) | 29 jobs | see PLATFORM_DIAGNOSTICS.md |

## Not tested

- **A physical Android phone.** Chromium's Pixel 7 emulation exercises the same download path, but not the phone's own download manager. To check by hand on Android Chrome:
  1. Paste an Instagram carousel link.
  2. Tap Download on one image: it should appear in Downloads.
  3. Select two images and tap ZIP: the .zip should appear in Downloads.
- **Downloads from the droplet's own IP.** Run `bash deploy/scripts/diagnose-platforms.sh` there after deploying.

\* The Imgur single-image sample (an upstream fixture from 2015) downloads, but as a 182-byte file. It may have been removed upstream. Static-image albums go through gallery-dl.
