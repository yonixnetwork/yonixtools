# Adsterra "ads not displaying": investigation, fix and test report

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
  - frames still have no top navigation, and pages keep the strict CSP.
  - Trade-off: the ad code can read the page it is embedded in, as any directly embedded ad tag can. The privacy page was corrected accordingly.
  - Full isolation *with* working ads needs a subdomain such as `ads.yonixtools.com` (needs DNS and your approval).
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
