# Staging test report: `staging/ads-monetag`

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

## B. Real-device evidence so far

- **8 Nov 2026, your phone, live `/ads-check/`:** in same-origin frames, all four Adsterra units rendered real creatives (image banners 320×50, 300×250, 728×90; native tiles). Sandboxed frames: banners empty, native nothing.
- Staging: **not yet run.** Fill in this table.

## C. Real-device checklist (staging)

Use `<site>` from `staging-web.sh up`. Don't click ads. Run each device in a clean session, then with an ad blocker. On each run, open `<site>/ads-check/`, wait about 15 s, tap **Copy report** and send it to me.

| # | Check | Android Chrome | iPhone Safari | Desktop Chrome |
|---|---|---|---|---|
| 1 | `/ads-check/`: Adsterra 4 units "AD RENDERED"? "Ad frame origin" shows the second tunnel | | | |
| 2 | `/ads-check/`: Monetag both zones "script loaded"; list "blocked by this site's security policy" | | | |
| 3 | Utility page (e.g. `/pdf-merger/`): In-Page Push visible? Does it cover controls? | | | |
| 4 | Browse 3–4 utility pages: does a Vignette appear, and does its own close work? How often? | | | |
| 5 | `/` and `/instagram-downloader/`: **no** Monetag; Adsterra only | | | |
| 6 | Downloader: paste a public TikTok/Instagram link → preview → quality → Download: file saves | | | |
| 7 | Utility download (e.g. QR → PNG, image compressor): file saves with Monetag active | | | |
| 8 | Layout: no horizontal scroll; ads never over the URL box, previews, quality options or Download buttons | | | |
| 9 | With ad blocker: no blank labelled boxes, tools work | | | |
| 10 | PWA: install offered (Android/desktop) / Add to Home Screen (iOS); `/offline/` works | | | |

**Reading the Monetag lines:** "blocked by this site's security policy: script-src blocked https://host…" lists the extra hosts Monetag needs. I'll turn them into an exact stage-2 diff, one line per host and directive, for your approval. Nothing gets added without that.
