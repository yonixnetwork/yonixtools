# Adsterra "ads not displaying": investigation, fix and test report

> **Update 12 Nov 2026:** current design and results are in `RELEASE_ADS_ADMIN_PWA.md` (separate ad origin `ads.yonixtools.com` only; no sandboxed or main-origin frames; Monetag in-frame; admin-only `/admin/ads/`; page CSP has no ad hosts).


Branch `feature/ads-fix`. **Not deployed.** Real ad delivery has **not** been observed yet. Automated browsers on datacenter IPs can't establish it, so it must be confirmed on real devices (see the end of this report).

## 1. Investigation of the live site

Method: `apps/web/scripts/ads/inspect-prod.mjs`, run in GitHub Actions (run 42493274213, 8 Nov 2026) against https://yonixtools.com.
- Real Chromium: desktop 1366 × 900 and Pixel 7.
- Pages: `/`, `/image-compressor/`, `/instagram-downloader/`, `/ads-check/`.
- Recorded: slot states every 4 s, network, console and page errors (including inside frames), each frame's DOM and access rights, and the `/ad-frame.html` headers.
- No clicks.

| Check | Result |
|---|---|
| Scripts requested | All four, once per page per unit: `bellnewyork.org/21/cdabddda…` (native) and `/22/620b31…`, `/22/087c1e…`, `/22/184daa…` (banners) |
| HTTP status | **200** for every script, desktop and Android |
| Duplicate loads | None. One frame per unit per page; never two copies of a unit |
| Container ids | Unique: one `#container-cdabddda…` per native frame |
| `atOptions` | Set inside each banner's own frame, right before its script. No overwriting is possible across units |
| CSP | `/ad-frame.html` carries the ad-friendly policy (any https script, frame, image or connect). No CSP violation was logged |
| React/Next | Not involved inside the frame. The frame is a static document; React only creates the iframe |
| **Execution in the default (opaque-origin sandbox) frames** | **Fails.** `origin: "null"`; `document.cookie`, `localStorage` and `top.location` all throw `SecurityError`. Adsterra's script throws `Failed to read the 'serviceWorker' property from 'Navigator': Service worker is disabled because the context is sandboxed and lacks the 'allow-same-origin' flag`. Nothing is inserted; the native container stays 0 px tall |
| Execution in same-origin frames (`/ads-check/` comparison) | Cookies, storage and top access OK, and no errors. No creative was returned within 16 s **to the datacenter, automated browser**. That can't distinguish "no fill / unit not approved" from "bot/datacenter traffic filtered" |
| Blank space | The native slot reserved 280 px (plus label: 301 px) and banners their full size, labelled "Advertisement", for about 9–12 s before collapsing |

**Root causes:**
1. **Integration failure.** The opaque-origin sandbox the first release used breaks Adsterra's code, so no ad could ever render on the site.
2. **The blank space** came from a tall fixed native reservation and a label shown before any ad existed.

Fill/approval is a separate question. It can only be answered from real devices.

## 2. What changed

- **Frames run with `allow-same-origin`** (default `AD_ISOLATION=same-origin`):
  - the publisher codes are unchanged, and so are the IDs, the provider and the placements;
  - **This removes isolation**: see §5 (security review) before production.
- **Strict fill detection.** A slot is "filled" only for real visible content, seen twice in a row:
  - a sized iframe that loaded a page, or that has content;
  - a loaded image, a video or a canvas;
  - a populated native container.

  A blank iframe or an empty element no longer counts.
- **Space:**
  - native reserves 100 px (was 280) and grows to the creative's height;
  - banners keep their exact size;
  - the label shows only above a rendered creative.
- **Empty slots:**
  - "empty" is reported immediately when the scripts fail (ad blocker or network), else after 8 s, with a 12 s page-side safety net;
  - an empty slot is blank and unlabelled;
  - it collapses at once when off screen, and otherwise when scrolled out of view or on the next tap or key press. So there is no layout shift while someone is looking at it.
- **`/ads-check/`** is now a real-device diagnostic with a **Copy report** button. For each unit and mode it shows:
  - script `loaded`/`failed` with timing;
  - errors thrown inside the frame, and CSP violations;
  - frame access (origin, cookies, storage, top);
  - the frame's DOM;
  - a verdict: AD RENDERED, blocked, integration errors, or no creative returned (fill/approval).
- **Staging:** `deploy/scripts/staging-web.sh` runs this build on the droplet at 127.0.0.1:8091 without touching production (DEPLOYMENT.md §10).

## 3. Automated tests (this branch, run locally; exit codes checked)

| Suite | Result |
|---|---|
| Unit (Vitest) | 167 / 167 passed |
| E2E, all default projects (desktop, mobile, iPhone UA, a11y, PWA, every tool) | **256 / 256 passed** |
| TypeScript | no errors |
| Lighthouse 12.6 performance (ad network blocked, i.e. the ad-blocker case) | `/`: mobile 97, desktop 100. `/image-compressor/`: 97 / 100. `/instagram-downloader/`: 97 / 100. **CLS 0.000 on all six** |

Before the collapse-while-visible rule, `/image-compressor/` mobile measured CLS 0.126. That is why collapse is deferred while the slot is on screen.

New ad tests (`tests/e2e/ads.spec.ts`). Tests never contact the ad network: its scripts are stubbed.
- Publisher codes are served byte for byte.
- Frames use `allow-same-origin` without top navigation; banners have their exact size; native is ≤ 100 px while loading; the label is hidden while loading.
- Network blocked: the slot turns empty in under 4 s and collapses on interaction or when off screen; the tool keeps working; no page errors.
- **A script that loads but returns nothing, or inserts a blank 300 × 250 iframe, is not treated as an ad:** the slot goes empty and collapses.
- Simulated banner creative: the slot stays filled and labelled. Simulated native creative: the slot grows to its 240 px height. These are plumbing tests, **not proof of Adsterra delivery.**
- `/ads-check/` report: tells "script blocked" apart from "ran, no creative returned", and shows `cookies=ok storage=ok`.

## 4. Not tested: needs your devices

No real ad has been seen rendering on the site, so **this report does not claim the ads are fixed**. The evidence shows the integration failure is removed (errors gone, full access in the frame). Whether Adsterra returns creatives depends on fill and unit approval, which only real traffic shows.

Please run `/ads-check/` (step 1 of DEPLOYMENT.md §10 works on the live site today: look at "Mode: same-origin") on each of these, with no VPN, without clicking any ad, and send the copied reports:

| Device / browser | Clean session | With ad blocker |
|---|---|---|
| Android Chrome | | |
| iPhone Safari | | |
| Desktop Chrome | | |

For each unit, the report gives script status, execution (loaded / errors), container DOM, whether an ad rendered and when, and frame errors.
- "EMPTY: script loaded and ran without errors, no creative returned" on every device points to fill or unit approval: check the Adsterra dashboard and units.
- "script ran but threw errors" points to an integration problem: send the report.

## 5. Security review of same-origin frames (added after review)

**Real-device evidence (your saved `/ads-check/` page, 8 Nov 2026):**
- **same-origin frames:** all four units rendered real ads. Banners: `<a><img width=320/300/728 …></a>` from `cdn.storageimagedisplay.com`. Native: populated tiles.
- **sandboxed frames:** banners produced an empty inner document; native rendered nothing.

**Isolation test.** A simulated hostile creative (a local stub standing in for the ad script) ran in each mode on the local build:

| Attempt from inside the ad frame | sandboxed | same-origin |
|---|---|---|
| Read the page's DOM | blocked | **possible** |
| Inject an inline `<script>` into the page and run it | blocked | **runs** (page CSP has `'unsafe-inline'`) |
| Add an external `<script src>` to the page | blocked | tag added. Production's page CSP (`script-src 'self'`) would block the load; the test server has no CSP |
| `top.location = …` from the frame | blocked | blocked (`SecurityError`) |
| **Redirect the page via injected inline code** | blocked | **page redirected to https://example.org/redirect** |
| Use its own storage | blocked | possible |

**Conclusion:** the change makes ads render but **weakens isolation**. A malicious or compromised creative could read what visitors type or paste and force-redirect the page. That is the same exposure as Adsterra's standard direct-in-page tag, but worse than what the site has today. **Not recommended for production as is.**

**Fix: serve the ad frame from a separate origin we own.** The frame then keeps `allow-same-origin`, which gives Adsterra cookies, storage and service worker on *its own* origin. The browser blocks access to the page, and there's still no top navigation.
- **Option A, no DNS change:** `https://yonixtools.com:8443`, the same hostname on another port, with the existing certificate. Needs:
  - an edge Nginx server on 8443 that serves only `/ad-frame.html`;
  - the firewall port opened;
  - the page CSP `frame-src` gaining exactly that origin.

  Cookies are not port-isolated: the frame could read this site's non-HttpOnly cookies. Today that is only the download-progress tokens. Storage, DOM and service worker are isolated.
- **Option B:** `https://ads.yonixtools.com`. Needs a DNS A record and a certificate. Fully isolated, cookies included.

The frontend switch for this is on branch `feature/ads-isolated-origin` (`NEXT_PUBLIC_AD_ORIGIN`, default off). The exact config changes are in `docs/ADS_ISOLATION_PROPOSAL.md`. Nothing is applied until you approve.

## 6. Staging run (approved): `feature/ads-fix`

On the droplet. Production containers, edge proxy, firewall and DNS are untouched:

```bash
cd /opt/yonixtools && git fetch origin
git worktree add /opt/yonixtools-staging origin/feature/ads-fix 2>/dev/null || (cd /opt/yonixtools-staging && git checkout --detach origin/feature/ads-fix)
cd /opt/yonixtools-staging
bash deploy/scripts/staging-web.sh up       # build + smoke test on 127.0.0.1:8091
bash deploy/scripts/staging-web.sh tunnel   # prints "Staging URL: https://<random>.trycloudflare.com"
```

**Caveat:** the staging hostname isn't yonixtools.com. If Adsterra doesn't serve that hostname, "no creative returned" on staging is not an integration failure. Rendering with the same frame mode is already proven on yonixtools.com (§5, your saved page).

**Checklist.** Run in a clean session, then with an ad blocker, on Android Chrome, iPhone Safari and desktop Chrome. Don't click ads.

| Check | How |
|---|---|
| All four units render | `<staging>/ads-check/` → wait 15 s → Copy report. Expect "AD RENDERED" for banner320x50, banner300x250, banner728x90 and native in "same-origin" |
| Real pages | Home, `/image-compressor/`, `/instagram-downloader/`: ads appear with the "Advertisement" label only above a real ad |
| Empty frames collapse | With an ad blocker: report says "script blocked"; on real pages the slots disappear (when scrolled away or on the next tap) with no label left behind |
| No layout break | No horizontal scrolling on phones; nothing covers the URL box, previews, quality options or Download buttons |
| Downloader | Paste a public TikTok/Instagram link → preview → Download: the file saves |
| PWA | Desktop Chrome: install icon still offered; `/offline/` works |

Clean up with `bash deploy/scripts/staging-web.sh down`.

**Security status for production:** this branch is **not** recommended for production as is (§5). Stage `feature/ads-isolated-origin` once its config is approved (`docs/ADS_ISOLATION_PROPOSAL.md` on that branch).
