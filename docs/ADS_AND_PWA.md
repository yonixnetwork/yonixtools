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

### How the units are loaded, and why

**What the codes do:**

- The banner code sets a page-global `atOptions`, then loads a script that reads it. Two banners on one page would overwrite each other's `atOptions`.
- The native code looks up a fixed container id, so it can exist only once per document.
- I could not inspect the scripts themselves. Adsterra's server answers datacenter IPs with **HTTP 403** (the GitHub Actions probe, `.github/workflows/ads-probe.yml`), so I made no assumption about whether they use `document.write`, storage or cookies.

**The design that follows:**

- Each placement is an `<AdSlot>` that, when it comes within 300 px of the screen, loads `/ad-frame.html?u=<unit>&s=<slot>` in its own iframe.
- That document writes the exact publisher snippet while parsing, as if it were in a page's source. So:
  - every banner has its own `atOptions`;
  - the native container id is unique per frame;
  - `document.write` works.
- **Sandboxed** (`allow-scripts allow-popups allow-popups-to-escape-sandbox`, no `allow-same-origin`, no top navigation):
  - the ad runs with an opaque origin;
  - it cannot read or change the downloader or tool pages, their storage or cookies;
  - it cannot redirect the page;
  - an ad click opens the advertiser in a new tab.
- **CSP:** only `/ad-frame.html` gets an ad-friendly policy (any https host, since ad creatives rotate across many). Every other page keeps the strict site-wide policy, where scripts load only from the site itself.
- **Space reserved in the HTML** at the unit's real size, so there is no layout shift (Lighthouse CLS 0).
- **Empty slots collapse:** if nothing renders within 9 s (ad blocker, no fill, network error), the slot disappears. No broken boxes are shown.
- **Limits:**
  - one instance of each unit per page;
  - on phones, a leaderboard slot uses 320 × 50, never a squeezed 728 × 90;
  - every slot is labelled "Advertisement".

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
| `AD_ISOLATION=same-origin` | the ad frame may use cookies and storage. Use this **only** if `/ads-check/` shows units filling in this mode and not in "sandboxed". It weakens isolation: the ad frame could then reach the page. |

Set either before running `deploy.sh`, for example `ADS=off bash deploy/scripts/deploy.sh`.

### Verifying real delivery

Ad servers refuse datacenter traffic (403 from GitHub, and likely from the droplet), so delivery can only be confirmed from a real device:

1. Deploy.
2. On your phone (no VPN, no ad blocker), open `https://yonixtools.com/ads-check/`. It is not linked anywhere and is noindex.
3. Each unit is shown in both isolation modes, with its state: **loading → filled** or **empty**.
4. Check the Adsterra dashboard for impressions a few hours later.

### Policy notes

- Adsterra's publisher terms say the publisher "shall not alter the Adsterra Ad Tag in any way without Adsterra's prior written consent". The tags are unchanged, but they run inside an isolated frame. **Confirm this setup with Adsterra support** before relying on the revenue.
- The privacy policy (`/privacy/`) now discloses Adsterra, cookies and identifiers in the ad frames, and links to Adsterra's privacy policy.
- **EU/UK visitors:** ad cookies may require prior consent (ePrivacy/GDPR). No consent banner (CMP) is included; adding one is recommended if a meaningful share of traffic comes from the EU/UK.

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
