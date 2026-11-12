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

## 10. Update 12 Nov 2026 (later): central placements, Monetag diagnostics, delivery counts

**The newest owner rules replace §9's download-panel ad.** There are no ads when Download is clicked or while a file is processed. The panel keeps its progress, Cancel and Hide, and its placement (`downloader.panel`) is switched off.

**Central placement configuration: `apps/web/src/lib/ads/placements.ts`.**
- **Fields:** each row has an id, page type, position, network, format, devices and on/off, plus a note.
- **How pages use it:** pages only declare `<AdPlacement page=… position=… />`.
- **Changing an ad:** move it, add it or switch it off by editing that one table. A unit test (`tests/unit/placements.test.ts`) keeps the rules:
  - no zone repeated on a page;
  - at most one native unit;
  - at most 3 ads on phones and 4 on desktop;
  - never Monetag on the homepage or downloader pages;
  - no native on phones;
  - nothing above the URL box.

| Page | Phone | Desktop |
|---|---|---|
| Home | 320×50 after the hero · 300×250 between Popular tools and Categories | 728×90 after the hero · 300×250 mid-page · native lower down (after Recommended) |
| Utility tool | 320×50 before the tool · 300×250 after the tool | 728×90 before the tool · 300×250 after · In-Page Push (How to use → Features) · native before the FAQ |
| Downloader | 320×50 below the downloader/results · 300×250 after the FAQ | + native between How to use and Features. No Monetag, nothing above the URL box or inside results, none in the download panel |
| All tools, categories with 9+ tools | full-width 320×50 after the first 6 tools (hidden while searching) · In-Page Push after the list | full-width 728×90 after the first 6 tools · native after the list |

**Empty slots** now collapse only *after* a tap or click has finished. Collapsing on press-down moved the tool under the pointer when a slot above it was empty (seen with ad blockers).

**Monetag diagnostics, admin only:**
- **Requests:** each test frame now lists the network requests it made (from Resource Timing; hosts and paths only).
- **Top-level check** (*replaced in §11: it now lives only in the password-protected `/ad-test.html`*): `/admin/ads/` links to "Open In-Page Push / Vignette top-level". These load the same zone code as a normal page on the ad origin, not framed, and show their own status.
  - Rendered top-level but not framed means the zone refuses frames.
  - Empty in both means no fill, or the domain or zone isn't approved.

**Delivery counts:**
- **How it works:** each slot reports one outcome to this site's backend (`POST /api/v1/ad-events`): `requested`, `filled` (a real creative rendered), `empty` (no fill) or `blocked` (scripts unreachable or ad blocker). Each report carries the placement id, the unit and mobile/desktop, and is rate-limited and enum-validated.
- **What is kept:** counts only, in memory, reset on restart.
- **Where to see them:** on `/admin/ads/` via `/admin/api/ad-stats`, behind the admin password. nginx strips the admin header from all public `/api/` requests.
- **Not measured:** these are not impressions, clicks or revenue. Use the Adsterra and Monetag dashboards for those.

## 11. Security fixes before deploying (12 Nov 2026, owner-approved): ad documents and cookies

**Gap 1: the main site never serves the ad documents.**
- **Where it's enforced:** in the web container's own nginx (`deploy/nginx/web.conf`), not only at the edge.
  - A map on the Host header recognises the ad origin. Its host[:port] is written in at image build from `AD_ORIGIN` (`apply-build-options.sh`).
  - `/ad-frame.html` and `/ad-test.html`, under any spelling or query (`/ad-frame…`, `/ad-test…`), answer **404** on every other host, including `yonixtools.com`.
  - The ad host answers 404 for every path except those two documents.
  - With no ad origin configured, neither document is served at all.
- **The edge** needs no change on the main site. The commented suggestion in `edge-ads-origin.conf` is gone.
- **Host header:** the container trusts the Host header the edge sends, which the edge takes from the real hostname. Sending `Host: ads.yonixtools.com` reaches the ad server block, which is the ad origin as far as browsers are concerned. It can't put ad code under the yonixtools.com origin.
- **Tests:**
  - real-nginx e2e (`admin.spec.ts`);
  - the static test server applies the same rule (`ORIGIN_ROLE`);
  - `smoke-test.sh` checks the main origin returns 404 for both documents. With `AD_HOST` set, as `deploy.sh` does from `AD_ORIGIN`, it also checks the ad origin;
  - CI's Docker job builds with the production ad origin and runs both sets of checks.

**Gap 2: diagnostics only behind a server-side password.**
- **`/ad-frame.html` (public)** has no diagnostics left:
  - no script, error, request or DOM reporting, and no panel;
  - it ignores any query and does nothing when opened outside a frame;
  - it tells its slot only `{state, height, reason}`, which the slot needs to collapse and to count.
- **`/ad-test.html` (new, ad origin only):**
  - nginx HTTP basic auth with the admin password file; it fails closed (401 for visitors, 403 when no password file exists);
  - rate-limited, `Cache-Control: no-store`, `X-Robots-Tag: noindex`;
  - CSP `frame-ancestors 'self'`, so only its own framed runs can embed it;
  - the same exact publisher snippets.
- **What it shows:**
  - every format framed, plus "open top-level" (a separate top-level document on the ad origin, never on the site);
  - outcomes, kept apart strictly: CREATIVE RENDERED, script loaded, the network requests made (Resource Timing, which hides other sites' status codes), REQUEST BLOCKED (script couldn't load), SCRIPT FAILED (loaded but threw errors) and NO CREATIVE RETURNED. A loaded script alone is never "rendered".
- **`/admin/ads/` (main site, password):** now frames only the public ad frame, like a real slot, and links to `/ad-test.html`.
- **Staging:** the gatekeeper protects `/ad-test.html` with the staging password, and the app checks the admin login again.
- **Production:** `edge-ads-origin.conf` in the repo has the matching `location = /ad-test.html`. **It isn't installed.** Until it is, production answers 404 for `/ad-test.html` (safe). Installing it is a production edge change that needs your approval.

**Parent-domain cookie risk (point 4).**
- **Can ads.yonixtools.com set cookies with `Domain=yonixtools.com`?** **Yes.** Browsers let any host set cookies for its parent domain unless that domain is a public suffix, and yonixtools.com isn't one. A cookie set that way is sent to yonixtools.com and every subdomain. This was confirmed by the control in the new test: an unguarded page on a sibling host does set a domain-wide cookie.
- **What we do about it:**
  1. **Cookie guard in both ad documents**, installed before the publisher code. It strips `Domain=` from cookies set through `document.cookie` and the Cookie Store API, in the document itself and in same-origin child frames the ad code creates. The test fails when the guard is removed.
     - **Best effort, not a guarantee:** ad code that finds another fresh JavaScript context (e.g. via `window.frames[0]` before touching the frame element) could still set a domain cookie.
  2. **The site's own cookie is now `__Host-ytx_dl_<token>`** on HTTPS. The browser refuses any cookie of that name that carries a Domain attribute, so the ad origin can't set or overwrite it.
  3. **What a stray domain cookie could and couldn't do:**
     - the site doesn't use cookies for login (admin uses HTTP authentication), so it can't hijack anything;
     - the worst case is a "cookie bomb": enough junk cookies that yonixtools.com rejects that one browser's requests until the cookies expire or are cleared.
  4. **Responses from the ad origin itself** can't set cookies: the edge strips `Set-Cookie`.
  5. **Unchanged:** the main site's CSP; the frame isolation for DOM, URLs, localStorage and service worker (different origins); the sandbox without top navigation.
- **Not claimed:** complete cookie isolation. Both hosts share the registrable domain yonixtools.com.
- **For complete cookie isolation, a separate advertising domain is required** (for example `yonixtools-ads.com`, a different registrable domain). Cookies can't cross registrable domains at all, and the browser also treats such frames as third-party. That needs a domain purchase, DNS, a certificate, and the ad networks' approval of the new domain. It's your decision; nothing has been started.
