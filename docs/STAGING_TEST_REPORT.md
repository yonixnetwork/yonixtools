# Staging test report: `staging/ads-monetag`

> **Superseded in part (12 Nov 2026):** ads now run only from the separate ad origin, Monetag In-Page Push runs inside it, Vignette is disabled, and the diagnostics moved to the admin-only `/admin/ads/`. Current results and the device checklist: `RELEASE_ADS_ADMIN_PWA.md`.

Production is not deployed and not changed.

## A. Automated results (this branch, run locally, exit codes checked)

| Suite | Configuration | Result |
|---|---|---|
| E2E, all projects (every tool, downloader UI, ads, Monetag, PWA, a11y, SEO, mobile, iPhone UA) + CSP sweep of every page | **staging config through the real nginx config**: separate ad origin, Monetag on, stage-1 CSP | **266 / 266 passed** |
| Same | **production default through the real nginx config**: Monetag off, no ad origin, CSP byte-identical to production | **258 passed, 9 skipped** (the Monetag-on tests; the `[off]` test confirmed no Monetag anywhere) |
| Same | CI-equivalent (plain test server) | 265 passed, 2 skipped (CSP sweep needs nginx; `[off]` test) |
| Downloader E2E against the real FastAPI backend (desktop + mobile: video, photo, carousel, ZIP, audio, errors, failed job) | integrated build | **22 / 22 passed** |
| Unit (Vitest), incl. Monetag central policy and a build-wide "no Monetag on any page with the URL box" check | — | **169 / 169 passed** |
| TypeScript | — | no errors |
| Isolation verification (`verify-isolation.mjs`, three origin models) | real nginx | see `ADS_ISOLATION_PROPOSAL.md` §2 |
| Smoke-test guard | production smoke against a Monetag build | correctly **fails** ("Monetag CSP present in a production build") |

What those tests prove:
- no CSP violation on any page in either configuration;
- Monetag zone scripts appear exactly once per allowed page, with the supplied zone IDs and URLs;
- **never** on `/`, any downloader page or the downloader category: checked statically, at runtime and across the whole build;
- downloads can't be intercepted by page-level click listeners;
- ad slots collapse when ads are blocked, with no page errors;
- PWA installability, offline pages, `/api/` never cached;
- no horizontal overflow on phones.

What they **don't** prove:
- that a real Adsterra or Monetag ad renders: ad networks were stubbed, and my environment can't reach them;
- behaviour in real Safari/WebKit and on real devices.

## A2. Staging safety checks (local, 12 Nov 2026)

| Check | Result |
|---|---|
| Gatekeeper (`deploy/staging/proxy.conf`) | 401 without or with a wrong password. `/admin/ads/` and `/api/*` locked. Ad-frame origin serves only `/ad-frame.html` (404 elsewhere). `robots.txt` = `Disallow: /`. `X-Robots-Tag: noindex` on every response incl. 401. API limit returns 429 after the burst |
| Full topology in Chromium | site through the password proxy, ad frame from the proxy's ad port. Stub ad filled. PWA installability errors: **none**. Service worker active. Monetag on the utility page, **not** on the downloader. **0 CSP violations** |
| Test-data backend through the proxy (phone viewport) | Instagram link → formats → **Download started**, MP4 saved (30 KB test clip) |
| `staging-web.sh` dry run (logging stand-in for docker) | preflight/tunnels/up/down run cleanly. Password file 600, hash 644, state folder 700. `down` removes every staging resource and the state folder |
| Egress firewall guard | the production chain can't be rebuilt with another subnet. Staging uses its own chain |

## A3. Incident: automated tests reached the real ad networks (found 12 Nov 2026; fixed)

**What happened:**
- CI runs on GitHub with real internet access. E2E tests that didn't stub the ad networks loaded the real ad scripts on pages with ads.
- **Adsterra:** likely since the ads release (7 Nov).
- **Monetag:** on the Monetag branches (since 8 Nov). CI run 42520517879 (8 Nov) recorded the requests, and the run in progress on 12 Nov was cancelled.
- Those were real ad requests from a datacenter, headless browser. Networks usually filter such traffic, but I can't confirm how many were counted. Worth checking the Adsterra and Monetag dashboards for impressions from US datacenter IPs on those dates.
- The two `prod-ads-inspect` runs I made on 8 Nov were deliberate inspections of the live site's ads; they were reported at the time.

**Fix:**
- **Chromium test projects:** every hostname except `localhost` resolves to "not found" (`playwright.config.ts`).
  - Verified: without the rule, a page reached the network; with it, the request failed at name resolution before any connection.
  - Guard test: `no-external-traffic.spec.ts` opens an ad page without stubs and asserts zero external responses.
- **Downloader test build** (used by the WebKit and live-platform suites): built with ads **off**, so it contains no ad code.
- **The two ad-inspection workflows** now run only when triggered manually from the Actions tab.

**What the incident revealed** (runtime hosts Monetag contacted, from CI's request log):

| Host | Request seen | Zone |
|---|---|---|
| `my.rtmark.net` | `/gid.js` | both |
| `jhnwr.com` | `/400/12218944?oo=1&sw_version=…&oaid=…` | In-Page Push |
| `ldrws.com` | `/401/12218952?oo=1&sw_version=…&oaid=…` | Vignette |

These are **candidates for stage 2. Not added.** The request type, and so the CSP directive, is unknown, and the hosts may rotate. Staging's `/admin/ads/` report shows exactly which directive blocked which host. The stage-2 diff will be built from that, for your approval.

## B. Real-device evidence so far

- **8 Nov 2026, your phone, live `/admin/ads/`:** in same-origin frames, all four Adsterra units rendered real creatives (image banners 320×50, 300×250, 728×90; native tiles). Sandboxed frames: banners empty, native nothing.
- Staging: **not yet run.** Fill in this table.

## C. Real-device checklist (staging)

Use `<site>` from `staging-web.sh up`. Don't click ads. Run each device in a clean session, then with an ad blocker. On each run, open `<site>/admin/ads/` (admin login), wait about 15 s, tap **Copy report** and send it to me.

| # | Check | Android Chrome | iPhone Safari | Desktop Chrome |
|---|---|---|---|---|
| 1 | `/admin/ads/`: Adsterra 4 units "AD RENDERED"? "Ad frame origin" shows the second tunnel | | | |
| 2 | `/admin/ads/`: Monetag both zones "script loaded"; list "blocked by this site's security policy" | | | |
| 3 | Utility page (e.g. `/pdf-merger/`): In-Page Push visible? Does it cover controls? | | | |
| 4 | Browse 3–4 utility pages: does a Vignette appear, and does its own close work? How often? | | | |
| 5 | `/` and `/instagram-downloader/`: **no** Monetag; Adsterra only | | | |
| 6 | Downloader: paste a public TikTok/Instagram link → preview → quality → Download: file saves | | | |
| 7 | Utility download (e.g. QR → PNG, image compressor): file saves with Monetag active | | | |
| 8 | Layout: no horizontal scroll; ads never over the URL box, previews, quality options or Download buttons | | | |
| 9 | With ad blocker: no blank labelled boxes, tools work | | | |
| 10 | PWA: install offered (Android/desktop) / Add to Home Screen (iOS); `/offline/` works | | | |

**Reading the Monetag lines:** "blocked by this site's security policy: script-src blocked https://host…" lists the extra hosts Monetag needs. I'll turn them into an exact stage-2 diff, one line per host and directive, for your approval. Nothing gets added without that.
