# Monetag security review (zones 12218952 Vignette, 12218944 In-Page Push)

> **Update 12 Nov 2026:** current design and results are in `RELEASE_ADS_ADMIN_PWA.md` (separate ad origin `ads.yonixtools.com` only; no sandboxed or main-origin frames; Monetag in-frame; admin-only `/admin/ads/`; page CSP has no ad hosts).


Status:
- **Stage 1 approved for staging only** (8 Nov 2026). It's applied at image build time only when `MONETAG=on`, by `deploy/nginx/apply-build-options.sh`.
- Production `docker-compose.yml` doesn't pass `MONETAG`, so production can't enable it.
- The production smoke test fails if the Monetag hosts ever appear in a production build.

**Where Monetag may run (central rule, owner decision 8 Nov 2026):** only ordinary utility pages, All tools, non-downloader category pages and `/ads-check/`. It never runs on:
- the homepage;
- any downloader page, results included;
- the downloader category;
- any page containing the URL box.

This is enforced in `apps/web/src/lib/ads/monetag-policy.ts` (the component renders nothing), again at runtime by the loader (path deny-list built from the registry + the downloader's `data-ytx-media-input` marker), and by tests over every built page.

## 1. The complete current page CSP (`deploy/nginx/security-headers.conf`)

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https:;
media-src 'self' blob:;
font-src 'self' data:;
connect-src 'self' data: blob:;
worker-src 'self' blob:;
frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none';
upgrade-insecure-requests
```

The other headers stay as they are: `X-Frame-Options: DENY`, `Cross-Origin-Opener-Policy: same-origin`, `Permissions-Policy` (camera self; microphone, geolocation, payment and usb off), `nosniff`, `strict-origin-when-cross-origin`.

Two broad permissions **already exist**; neither is added by this proposal:
- `'unsafe-inline'` in `script-src`: Next.js's static export uses inline bootstrap scripts.
- `img-src https:`: user-facing image tools and ad images.

Consequence: any script the CSP allows can run inline code in the page. **Allow-listing Monetag's hosts therefore means trusting Monetag with full page access.** That's inherent to these two formats: they draw over the page, so they can't be put in an isolated frame like the Adsterra units.

## 2. Origins the two zones need

| Origin | How known | Needed for |
|---|---|---|
| `https://n6wxm.com` | supplied code | Vignette loader `vignette.min.js` |
| `https://nap5k.com` | supplied code | In-Page Push loader `tag.min.js` |
| *(further hosts)* | not knowable statically. **Observed at runtime in CI (12 Nov):** `my.rtmark.net` (`/gid.js`), `jhnwr.com` (zone 12218944), `ldrws.com` (zone 12218952). Directive unknown; may rotate | ad requests, creatives, tracking |

**Static analysis evidence** (GitHub Actions run 42501157416, `apps/web/scripts/ads/inspect-monetag.mjs`; the scripts were downloaded as text and never executed):
- `vignette.min.js` → 200, 177,253 bytes. `tag.min.js` → 200, 153,458 bytes.
- Both are fully obfuscated: every string goes through a lookup table, so **no hostname appears in either file**.
- Only `fetch` and `XMLHttpRequest` are visible.

Whether they use `eval` or `new Function` can't be ruled out statically. If they do, the current CSP blocks it, and `/ads-check/` will report `script-src blocked eval`.

So further origins must be observed at runtime: `/ads-check/` on real devices lists every request the CSP blocks (`securitypolicyviolation`: directive + blocked URL).

## 3. Proposed CSP, stage 1: the exact diff

```diff
--- a/deploy/nginx/security-headers.conf
+++ b/deploy/nginx/security-headers.conf
-add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self' data: blob:; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests" always;
+add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://n6wxm.com https://nap5k.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self' data: blob: https://n6wxm.com https://nap5k.com; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests" always;
--- a/deploy/scripts/smoke-test.sh
+++ b/deploy/scripts/smoke-test.sh
-... grep -q "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval';" && ok "pages keep the strict CSP" ...
+... grep -q "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://n6wxm.com https://nap5k.com;" && ok "pages keep the strict CSP (plus the two Monetag loaders)" ...
```

What stage 1 does **not** add:
- no `frame-src` (frames stay `'self'` only);
- no `unsafe-eval`;
- no wildcard host;
- no change to `form-action`, `frame-ancestors`, `object-src`, `base-uri` or `worker-src`.

**Stage 2:** the exact extra hosts `/ads-check/` reports as blocked on staging, listed one by one (directive and host). I'll show you that diff before anything is applied.

**Risk to accept:** Monetag rotates domains. If the creative and frame hosts change often, an exact allow-list will silently lose ads until it's updated. If staging shows that pattern, I'll report it and the choice is yours. I won't widen the policy on my own.

## 4. Downloader interference

| Concern | Protection | Evidence |
|---|---|---|
| Vignette intercepting link clicks during a download | Download buttons start the file from a **detached** link, so the click event never reaches page listeners. Fallback "Save it here" links stop the click inside the app | e2e `monetag.spec.ts`: page-level click listeners (capture and bubble) record **nothing** during a download |
| Forced countdown or redirect on Download | none is implemented; Monetag is never triggered by our code | code review |
| Ads covering controls | In-Page Push placement and vignette frequency are set in the Monetag dashboard | needs real-device check |
| A compromised Monetag script patching `fetch`, or reading the URL box | **cannot be prevented** for in-page scripts | inherent, see §5 |

## 5. Decisions for you

1. **Approve stage 1** (the exact diff in §3) for **staging only**.
2. **URLs pasted into the downloader.** Your standing rule says user URLs must not go to untrusted external sites. An in-page Monetag script *can* read the URL box. Options:
   - (a) don't load Monetag on pages with the downloader (home and downloader pages); tool, category and All tools pages only;
   - (b) accept the risk on all eligible pages.

   I recommend (a).
3. **Staging hostname.** Monetag zones are tied to yonixtools.com. A `*.trycloudflare.com` staging URL may get no ads. Real Monetag evidence needs staging on yonixtools.com itself: `https://yonixtools.com:8444`, a temporary edge server block plus firewall port (see `ADS_ISOLATION_PROPOSAL.md` on `feature/ads-isolated-origin`).

## 6. Unchanged

- PWA service worker (`public/sw.js`): it returns early for every cross-origin request (`if (url.origin !== self.location.origin) return;`), so Monetag traffic is never cached or touched.
- Monetag's own service worker (`5gvci.com`, zone 10832998) is not installed.
- No MultiTag, Popunder or Push Notifications. Adsterra units, IDs and placements are unchanged.

## 7. Staging test plan (after approval)

Build: `MONETAG=on bash deploy/scripts/staging-web.sh up`, with the approved CSP applied on the staging branch only. Then `tunnel`, or `:8444` if approved.

Run on Android Chrome, iPhone Safari and desktop Chrome, in a clean session and then with an ad blocker. Don't click ads.

1. `/ads-check/` → Copy report:
   - each Monetag zone shows `script loaded`;
   - "blocked by this site's security policy" lists hosts for stage 2;
   - "elements Monetag added" shows VISIBLE when an In-Page Push appears.
2. Vignette: browse between 3–4 tool pages; note whether it appears, closes with its own control, and how often.
3. Downloader: paste a public link → preview → Download. The file saves, and nothing intercepts or delays it.
4. Navigation: on each page, `/ads-check/` should show one script per zone, never duplicates.
5. Adsterra alongside: banners and native still render, and nothing overlaps.
6. With an ad blocker: no errors, tools work, no blank boxes.
