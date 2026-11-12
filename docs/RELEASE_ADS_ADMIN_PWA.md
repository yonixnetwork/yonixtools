# Advertising on an isolated origin, admin privacy, PWA install: release notes

Branch `staging/ads-monetag` (mirrored to `feature/ads-monetag-staging` for CI). **Not deployed.** Nothing in production, DNS or the firewall has changed.

## 1. Why the sandboxed ads were blank

The live site loads each Adsterra unit in an iframe sandboxed **without** `allow-same-origin`, which gives it an opaque origin.

**Measured on the live site** (8 Nov 2026, `scripts/ads/inspect-prod.mjs`):
- Adsterra's code throws `Failed to read the 'serviceWorker' property from 'Navigator': Service worker is disabled because the context is sandboxed and lacks the 'allow-same-origin' flag`.
- `document.cookie`, `localStorage` and `top.location` all throw `SecurityError`.
- Its banner code still inserts an inner `<iframe>`, but leaves it **empty**.

**Why "FILLED" appeared:** the old fill check counted any sized iframe, so the slot was labelled FILLED around a blank white box. That's exactly what your screenshots show.

**Your saved page and screenshots confirm the other side:** when the ad code runs with a real origin, all four units render real creatives. Banners show `<a><img …></a>` from `cdn.storageimagedisplay.com`; native shows tiles.

## 2. What is implemented now

**Every ad unit runs in its own iframe served from a separate origin: `https://ads.yonixtools.com`.**

Units:
- the four Adsterra units;
- Monetag In-Page Push.

**How it works:**
- **The frame document** (`/ad-frame.html`) writes the publisher's **exact** snippet, so there's no shared `atOptions` and each native container ID is unique.
- **The sandbox** is `allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox`.
  - `allow-same-origin` gives the frame **its own** origin (ads.yonixtools.com). Adsterra's code gets the cookies, storage and service-worker access it needs, so it renders.
  - There's no top-navigation permission of any kind.
  - Ad clicks open a new tab.
- **The removed paths:** the opaque sandbox mode and the "frame on the main origin" mode are both gone. The second one rendered ads, but a test creative could read the page and redirect it.
- **No ad origin configured means no ad slots at all,** never an empty box.
- **"Filled" is strict.** It needs a visible creative seen twice in a row: a loaded image, a sized iframe that loaded or has content, video/canvas, a populated native container, or visible content added by the Monetag zone. A blank iframe or an empty container is **empty**.
- **Empty slots** are blank and unlabelled, then collapse without layout shift: at once when off screen, otherwise on scroll-out or the next tap.
- **Publisher codes and zone IDs exist only in the ad-origin document** and the password-protected admin page. They're no longer in the site's pages or JavaScript bundles; a build-wide unit test checks this.

**Formats:**

| Format | Status |
|---|---|
| Adsterra 320×50 / 728×90 (responsive leaderboard) | on, isolated |
| Adsterra 300×250 | on, isolated |
| Adsterra native | on, isolated; grows to the creative's height |
| Monetag In-Page Push (zone 12218944) | on (when `MONETAG=on`), isolated. Utility pages only: never home, downloaders or the downloader category. Desktop-only on tool pages (≤ 2 ads on phones) |
| Monetag Vignette (zone 12218952) | **disabled on the site.** A full-page overlay can't be isolated in a frame, and running it in the page would expose the page to ad code. It stays testable on the admin page in a test frame |

Not used: Popunder, Smartlink, Social Bar, MultiTag, Push Notifications, and Monetag's service worker. The PWA service worker is unchanged, except that it now also skips `/admin/`.

## 3. How the ad origin is isolated

**Mechanisms:**
- **Same-origin policy.** The page (`yonixtools.com`) and the ad frame (`ads.yonixtools.com`) are different origins, so the browser blocks the frame from the page's DOM: the URL box, results and page address.
- **Storage and cookies.** It also blocks this site's localStorage and service worker. Host-only cookies of `yonixtools.com` are never sent to `ads.yonixtools.com`.
- **Navigation.** The sandbox has no top-navigation permission.
- **Popups.** The page's `Cross-Origin-Opener-Policy: same-origin` severs a popup's opener.
- **Page CSP.** `frame-src 'self' https://ads.yonixtools.com` adds exactly one origin, and `script-src` stays `'self' 'unsafe-inline' 'wasm-unsafe-eval'` (no ad hosts).
- **Ad-frame CSP.** `frame-ancestors 'self' https://yonixtools.com`.
- **Messages.** The page accepts a frame message only if the sending window is that slot's own iframe **and** the origin is the ad origin. Only `state` and `height` are used. Diagnostics are sent only to admin test slots.

**Evidence: real nginx config, stubbed creatives, Chromium.**
- Tests in every CI run (`ads.spec.ts`, port model `localhost:4173` vs `:4175`):
  - a hostile creative on a downloader page, after a URL was pasted, couldn't read the URL, the DOM or the page URL;
  - its injected script and its top navigation were blocked;
  - the page URL was unchanged, and the page's storage was invisible to it.
- `verify-isolation.mjs`, subdomain model (`ads.localhost`):
  - all of the above, plus redirecting through a popup was blocked;
  - the site's cookies were **not** visible to the frame;
  - spoofed messages had no effect;
  - the page's service worker was unchanged;
  - a legitimate creative still rendered.

**Not claimed:**
- complete security;
- WebKit/Firefox behaviour, which wasn't tested;
- defence against creative content that *looks* deceptive. Use Adsterra's category controls for that (the earlier tests showed casino ads).

## 4. Admin-only diagnostics and public information

- **The old public test page is removed:** `/ads-check/` now returns 404.
- **New `/admin/ads/`:**
  - a standalone document, not part of the site bundles;
  - nginx requires a password (HTTP auth over HTTPS), rate-limits it, and marks it `no-store` and `noindex`;
  - it fails closed: without a password file nobody gets the page, not even with valid credentials (401/403);
  - it tests all six formats side by side, each with AD RENDERED or EMPTY plus the reason, and has a Copy report button.
  - Create the login with `bash deploy/scripts/admin-password.sh`. It stores only a hash in `deploy/admin-auth/htpasswd`, which git ignores.
- **Backend:**
  - `/api/readyz` gives visitors only `{"status": …}`; internal checks are shown only to the server itself;
  - `/api/internal/*` stays blocked (404);
  - errors were already safe codes and messages: no paths, stack traces or tool output.
- **Removed public wording:**
  - "The file is deleted from our server shortly";
  - "Processed on our server · files deleted after 15 minutes";
  - "Link detection works · downloading launches with the backend" and "Backend coming soon";
  - "Checked … with real downloads from a cloud server".

  File retention is still disclosed on the Privacy page, where it belongs.
- **Ad labels for developers** (unit name, mode, state) are gone from public slots.
- **Test:** `tests/unit/public-exposure.test.ts` scans every built public page and bundle for publisher and zone IDs, ad hosts and internal wording.

## 5. PWA

**Already present and verified:**
- a valid manifest (id, name, short name, start URL and scope, standalone display, theme and background `#0a0b0f`, icons 192/512 in any and maskable variants, shortcuts);
- a versioned service worker with an offline page;
- Chromium's native prompt, installed detection, a 12 s delay and 30-day dismissal memory.

**Added:**
- declining **the browser's own** dialog is remembered;
- switching into standalone counts as installed;
- **all iPhone/iPad browsers** get Add to Home Screen instructions for their own Share location: Safari toolbar, Chrome address bar, Edge or Firefox menu. iPadOS is detected through "Mac UA + touch".

## 6. Approval needed before production

Nothing here has been done.

1. **DNS:** an `A` record `ads.yonixtools.com` → the droplet IPv4.
2. **Certificate:** `certbot certonly --webroot -w /var/www/certbot -d ads.yonixtools.com`.
3. **Edge proxy:** add `deploy/nginx/edge-ads-origin.conf`. It serves only `/ad-frame.html` on ads.yonixtools.com, and `location = /ad-frame.html { return 404; }` goes on the main site. Validated with `nginx -t`.
4. **Admin login:** `bash deploy/scripts/admin-password.sh`.
5. **Deploy:** `AD_ORIGIN=https://ads.yonixtools.com bash deploy/scripts/deploy.sh`.
   - Without `AD_ORIGIN`, the site shows **no ads**. This replaces today's blank boxes.
   - Monetag stays off in production builds until you decide.
6. **Ad networks:** you may need to add `ads.yonixtools.com` as a site or subdomain in the Adsterra and Monetag dashboards.

## 7. Test results (local; CI on push)

| Suite | Result |
|---|---|
| E2E, CI-equivalent (site :4173 + ad origin :4175) | 269 passed, 6 skipped (real-nginx-only tests and the Monetag-off test) |
| E2E through the real nginx config, incl. admin authorization + CSP sweep of every page | 274 passed, 1 skipped (Monetag-off test) |
| Downloader E2E against the real backend | 22 / 22 |
| Unit (Vitest), incl. public-exposure scan and ad-origin validation | 176 / 176 |
| Backend (pytest), incl. new readyz/internal access test | 269 passed, 12 skipped |
| TypeScript, shellcheck (all scripts) | clean |
| Fail-closed admin (no password file) | 401 visitor, 403 even with credentials |

**Tests can never reach an ad network.**
- Chromium resolves every non-local host to "not found", and all non-local traffic is sent to a dead proxy port.
- A full local run showed zero outbound connection attempts.
- A guard test opens an ad page without stubs.

**Not tested on real devices** (this environment can't reach the ad networks or a phone):
- real creatives through `ads.yonixtools.com`;
- Monetag In-Page Push rendering inside a frame;
- Android Chrome, iPhone/iPad Safari and desktop Chrome/Edge install flows.

Use the staging runbook and `/admin/ads/` → Copy report.

## 8. Device checklist (staging or after deploy)

| Check | Android Chrome | iPhone Safari | iPad Safari | Desktop Chrome / Edge |
|---|---|---|---|---|
| `/admin/ads/`: each of the six formats AD RENDERED or EMPTY (+ reason) | | | | |
| Real pages: ads only where filled, no blank labelled boxes, nothing over controls | | | | |
| Downloader: paste, preview, Download saves the file; no Monetag on the page | | | | |
| Utility page: In-Page Push (desktop) appears or collapses | — | — | — | |
| Install: card after ~12 s → native prompt (Chrome/Edge) or guide (iOS); "Not now" remembered; nothing once installed | | | | |
| Offline: visited pages open in airplane mode | | | | |
| With an ad blocker: no errors, tools work, no empty boxes | | | | |


## 9. Update 12 Nov 2026: staging results, ad spacing, download panel

**Staging (real phone, Android Chrome, temporary trycloudflare addresses):**
- **Adsterra:** all four units (320×50, 300×250, 728×90, native) showed **real creatives** through the isolated ad origin. The report showed `top=blocked`, so the ad code couldn't reach the page, and screenshots confirm the images.
- **Monetag** In-Page Push and Vignette: the scripts loaded with no errors, but **no creative**. The zones are registered for yonixtools.com, so the next test is on `ads.yonixtools.com`.

**Ad spacing (owner rule): never two ads in a row.**
- The native unit is wide-screen only. On phones it stacks its 4 tiles into one ~1,100 px column of ads.
- Listing pages show one slot per screen size: native on wide screens, In-Page Push on phones.
- On tool pages, In-Page Push sits between "How to use" and "Features".
- `ad-spacing.spec.ts` checks every page type on phone and desktop: at least 80 characters of real content between any two visible ads, and no more than 3 ads on a phone.

**Download panel (owner request; replaces the earlier "no ad on Download" rule).**
- **When it appears:** after choosing a quality, a non-blocking panel shows the real preparation progress and one labelled 300×250 ad from the isolated origin.
- **Controls:** **Cancel download** stops it, so no file is started. **Hide** keeps it going. After the download starts, the panel stays with **Close**.
- **No waiting:** nothing waits for the ad. A test with a hanging ad script still downloads immediately.
- **Without ads:** if no ad origin is configured, the panel shows only the progress.
