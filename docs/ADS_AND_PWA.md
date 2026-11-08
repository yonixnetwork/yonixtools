# Advertising (Adsterra) and PWA installation

## Advertising

### Units (verbatim publisher code)

All four units live in one file, `apps/web/src/lib/ads/units.json`. They are copied exactly as supplied; a test compares them with the original snippets byte for byte.

| Unit | Key / ID | Size |
|---|---|---|
| Native Banner | `cdabddda1b7a8e769299c93b91d77822` (`/21/`) | responsive, about 280 px reserved |
| Banner | `620b3190e30ed523091b51770aea0b40` (`/22/`) | 300 × 250 |
| Banner | `087c1ea1a028c67071c19090b33ca01b` (`/22/`) | 728 × 90 |
| Banner | `184daaa0dde35a067c7494257f37cd70` (`/22/`) | 320 × 50 |

Popunder, Smartlink and Social Bar are **not** used.

**Real-device result (8 Nov 2026, your saved `/ads-check/` page):**
- in "same-origin" frames, all four Adsterra units rendered real creatives (image banners in 320×50, 300×250 and 728×90, plus native tiles);
- in "sandboxed" frames (the first release), the banners produced empty documents and native nothing.

### How the units are loaded, and why

**What the codes do:**

- The banner code sets a page-global `atOptions`, then loads a script that reads it. Two banners on one page would overwrite each other's `atOptions`.
- The native code looks up a fixed container id, so it can exist only once per document.
- I could not inspect the scripts themselves. Adsterra's server answers datacenter IPs with **HTTP 403** (the GitHub Actions probe, `.github/workflows/ads-probe.yml`), so I made no assumption about whether they use `document.write`, storage or cookies.

**Measured on the live site (Nov 2026, `scripts/ads/inspect-prod.mjs`, run 42493274213):** all four scripts load (HTTP 200). In the first release's opaque-origin sandbox, Adsterra's code throws `Failed to read the 'serviceWorker' property from 'Navigator': Service worker is disabled because the context is sandboxed and lacks the 'allow-same-origin' flag`, and nothing renders. The 280 px native reservation then sat blank, with its label, until the slot collapsed. Details and the test log are in `ADS_FIX_TEST_REPORT.md`.

**The design that follows:**

- Each placement is an `<AdSlot>` that, when it comes within 300 px of the screen, loads `/ad-frame.html?u=<unit>&s=<slot>` in its own iframe.
- That document writes the exact publisher snippet while parsing, as if it were in a page's source. So:
  - every banner has its own `atOptions`;
  - the native container id is unique per frame;
  - `document.write` works.
- **Frame isolation (default `same-origin`):** `sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"`.
  - Adsterra's code gets the cookies, storage, service-worker and top-window access it needs.
  - A click opens the advertiser in a new tab.
  - **Security: this is not isolation.** A same-origin frame can read the page. Because the page CSP allows inline scripts (Next.js needs them), it can also run code in the page, including redirecting it. This was tested with a simulated hostile creative (`ADS_FIX_TEST_REPORT.md` §5). The exposure equals pasting the ad tag into the page.
  - Isolation *with* working ads needs the frame on a separate origin we control: `https://yonixtools.com:8443` (no DNS change) or `ads.yonixtools.com` (DNS). See §5 of the report; it needs your approval.
- **CSP:** only `/ad-frame.html` gets an ad-friendly policy (any https host, since ad creatives rotate across many). Every other page keeps the strict site-wide policy.
- **Space:**
  - banners reserve their exact size (300 × 250, 728 × 90, 320 × 50);
  - native reserves 100 px and grows to the creative's real height;
  - the "Advertisement" label appears **only once a creative has rendered**.
- **What counts as an ad (strict):** the frame reports "filled" only for real visible content, seen on two checks in a row. That means:
  - a sized iframe that loaded a page, or that has content;
  - a loaded image, a video or a canvas;
  - for native, a populated container.

  A blank iframe, an empty link or an empty container does not count.
- **Empty slots:**
  - "empty" is reported at once when the ad scripts fail (ad blocker, network), or after 8 s with no creative (12 s page-side safety net);
  - an empty slot is blank and unlabelled;
  - it collapses immediately when off screen, and otherwise when it scrolls out of view or on the next tap or key press. Layout changes right after input don't count as layout shift, so CLS stays 0.
- **Limits:**
  - one instance of each unit per page;
  - on phones, a leaderboard slot uses 320 × 50, never a squeezed 728 × 90.

### Placements

| Page | Phone | Desktop |
|---|---|---|
| Home | 320 × 50 under the downloader; native before "Popular tools" | 728 × 90 under the downloader; native |
| Tool pages (all 53 browser tools) | 300 × 250 under the tool; native before the FAQ | same, plus a 728 × 90 at the end of the page |
| Downloader pages | 320 × 50 under the downloader and its results; native between "How to" and "Features"; 300 × 250 after the FAQ | 728 × 90 instead of 320 × 50 |
| All tools, category pages | native after the list | native after the list |
| Privacy, Help, Offline, unavailable-platform pages | none | none |

Ads never appear inside a tool, between quality choices, inside previews, or next to a Download button without space between them.

### Switches (no code change needed)

| Setting | Effect |
|---|---|
| `ADS=off` | build without any ads (e.g. staging) |
| `AD_ISOLATION=sandboxed` | opaque-origin frames (full isolation). Adsterra's code fails in this mode; it is kept for comparison on `/ads-check/` |

Set either before running `deploy.sh`, for example `ADS=off bash deploy/scripts/deploy.sh`.

### Verifying real delivery

Ad servers treat datacenter and automated traffic differently, so delivery can only be confirmed from a real device. **Don't click the ads.**

1. On a phone or computer (no VPN; run once without and once with an ad blocker), open `/ads-check/`.
2. Scroll to the bottom, wait about 15 s, and tap **Copy report**. For every unit and mode the report gives:
   - **AD RENDERED (after N ms)**;
   - **EMPTY: ad script blocked or unreachable** (ad blocker, network);
   - **EMPTY: script ran but threw errors** (integration problem; the errors are listed);
   - **EMPTY: script loaded and ran without errors, no creative returned** (no fill, or unit not approved yet; check the Adsterra dashboard).
3. Each line also shows the script load state and timing, the frame's access (origin, cookies, storage, top), and the frame's DOM.

### Policy notes

- Adsterra's publisher terms say the publisher "shall not alter the Adsterra Ad Tag in any way without Adsterra's prior written consent". The tags are unchanged, but they run inside an isolated frame. **Confirm this setup with Adsterra support** before relying on the revenue.
- The privacy policy (`/privacy/`) now discloses Adsterra, cookies and identifiers in the ad frames, and links to Adsterra's privacy policy.
- **EU/UK visitors:** ad cookies may require prior consent (ePrivacy/GDPR). No consent banner (CMP) is included; adding one is recommended if a meaningful share of traffic comes from the EU/UK.

## Monetag (Vignette Banner + In-Page Push)

| Zone | ID | Script |
|---|---|---|
| Vignette Banner | `12218952` | `https://n6wxm.com/vignette.min.js` |
| In-Page Push (banner) | `12218944` | `https://nap5k.com/tag.min.js` |

**Code and loading:**
- The snippets are stored verbatim in `apps/web/src/lib/ads/monetag.json`; a test compares them with the supplied code.
- `<MonetagZones />` loads them on eligible pages: home, tool pages, downloader pages, All tools and category pages. Never on privacy, help, offline or unavailable-platform pages.
- Each snippet is wrapped unchanged in a once-per-page guard, so a re-render or second mount adds nothing.
- They load with `next/script` `lazyOnload`, after the page has loaded, so they never block the tools.
- Navigation between pages is a full page load, so each page view loads each zone exactly once.

**Formats and settings:**
- Both formats draw over the page, so they run in the page itself, unlike the Adsterra frames.
- Where and how often they appear, and their close controls, are Monetag's. Set frequency caps in the Monetag dashboard. No timing or close button is added by us.
- Not used: MultiTag, Popunder, Push Notifications, and Monetag's service worker (`5gvci.com`, zone `10832998`). The PWA service worker is unchanged.

**Downloads:**
- Download buttons start the file from a link that isn't attached to the page, so the click never reaches page-level listeners.
- The "Save it here" fallback links stop their click inside the app.
- A test proves page-level click listeners see nothing.

**Switch:** `MONETAG=on|off`, default **off** in Docker builds.

### Blocked: the page Content-Security-Policy

Pages currently allow scripts only from this site (`deploy/nginx/security-headers.conf`), so the browser blocks Monetag's scripts. For the zones to work, the page policy needs at least:
- Monetag's script hosts in `script-src` and `connect-src`: `https://n6wxm.com`, `https://nap5k.com`, plus any further hosts `/ads-check/` reports as blocked;
- `frame-src 'self' https:` for the creatives.

That loosens the site's security policy, so it needs your explicit decision. Until then, keep `MONETAG=off`.

## PWA

| Piece | What it does |
|---|---|
| `/manifest.webmanifest` | YoniXTools / YoniXTools, standalone, theme and background `#0a0b0f`, `start_url=/?source=pwa`; icons 192/512 (any + maskable); shortcuts: Downloader, All tools, Image Compressor, PDF Merger |
| `/sw.js?v=<build>` | Versioned shell precache, network-first pages with the `/offline/` fallback, cache-first hashed assets, old caches deleted on update. **Never** touches `/api/` (extraction, previews, downloads), the ad frame, other origins, non-GET or range requests. Served with `Cache-Control: no-cache` |
| Install invitation | Chromium (Android, desktop): the browser's real prompt, offered after 12 s on the page. "Not now" is remembered for 30 days; nothing is shown when already installed |
| iPhone/iPad Safari | A guide: Share → Add to Home Screen. Safari has no install prompt, so no fake button |
| Other browsers | No install button. The Help page explains installing for each browser |
| Drawer | "Install the app", only when installing is possible |

**Tested** (`tests/e2e/pwa*.spec.ts`):
- Chromium reports **no installability errors** (DevTools protocol `Page.getInstallabilityErrors`);
- the manifest parses without errors, and icons exist at their declared sizes;
- the service worker controls the page;
- visited pages open offline, and other pages show the offline page;
- a new build replaces the old caches;
- `/api/` is never cached;
- install invitation, dismissal memory, iOS guide, and no button when unsupported.

**Not tested on real devices:** the actual install sheet on an Android phone, desktop Chrome's install dialog, and iOS Add to Home Screen. Check them by hand after deploying; steps are in DEPLOYMENT.md §9.
