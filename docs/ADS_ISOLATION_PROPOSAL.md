# Adsterra frame isolation: review, evidence and proposal

> **Update 12 Nov 2026:** current design and results are in `RELEASE_ADS_ADMIN_PWA.md` (separate ad origin `ads.yonixtools.com` only; no sandboxed or main-origin frames; Monetag in-frame; admin-only `/admin/ads/`; page CSP has no ad hosts).


Status: **approved for staging tests only** (8 Nov 2026). Not for production until you approve it.

## 1. How the ad origin is isolated

Each Adsterra unit is an `<iframe>` whose document, `/ad-frame.html`, is loaded from a **different origin** than the page. Origin = scheme + host + port. The browser then enforces four separate mechanisms:

1. **Same-origin policy (DOM).** Script in the frame gets `SecurityError` on any access to `parent.document`, `top.document` or `top.location.href`. It can't read the page, the URL box or the results, and it can't insert elements or scripts into the page.
2. **Sandbox attribute** (set by the page and enforced by the browser): `allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox`.
   - `allow-same-origin` here means the frame keeps **its own** origin. That is the ad origin, not the site, so Adsterra's code gets its own cookies, storage and service-worker API, which it needs. With an opaque origin, it throws and renders nothing.
   - There's **no `allow-top-navigation`** (including the by-user-activation variant), so the frame can't navigate the page.
   - `allow-popups-to-escape-sandbox`: an ad click opens the advertiser in a new tab.
3. **Cross-Origin-Opener-Policy: same-origin** on the page: a popup opened from the ad gets `window.opener === null`, so it can't reach back into the site's tab.
4. **CSP.**
   - Page: `frame-src 'self' <ad origin>` allows exactly that one extra frame origin.
   - Ad frame: `frame-ancestors 'self' <site>` lets only our site embed it.
   - The ad frame has no `X-Frame-Options`.

The frame reports only `{state, height, diagnostics}` to the page by `postMessage`. The page accepts a message only if **both** the sending window is that slot's own frame and the origin equals the configured ad origin. A message can't affect another slot.

## 2. Evidence

Real nginx config (`apps/web/scripts/nginx-local.sh` + `scripts/ads/verify-isolation.mjs`). The ad scripts were replaced by a stub "hostile creative" on `/instagram-downloader/` after a test URL had been pasted into the URL box. The hostile creative tried everything below, in two phases: reads first, then code execution and redirects.

| Attempt from inside the ad frame | Same-origin frame (feature/ads-fix) | Port origin (`localhost:4175`, models `:8443`) | Subdomain origin (`ads.localhost`, models `ads.` subdomain) |
|---|---|---|---|
| Read the pasted URL | **read it** | blocked (SecurityError) | blocked |
| Read the page DOM / title | **yes** | blocked | blocked |
| Read the page URL | **yes** | blocked | blocked |
| Inject and run a script in the page | **ran: page redirected to another site** | blocked | blocked |
| `top.location = …` from the frame | — (page already hijacked) | blocked (sandbox) | blocked |
| Popup → `opener.top.location = …` | — | blocked; opener is `null` (COOP) | blocked; opener `null` |
| Page's **localStorage** visible to the frame | yes | **no** | **no** |
| Frame's localStorage visible to the page | yes | no | no |
| Page's **cookies** visible to the frame | yes | **yes** (cookies ignore ports) | **no** |
| Frame sets a cookie the page then receives | yes | **yes** | no¹ |
| Register a service worker | rejected | rejected | rejected |
| Spoof another slot via `postMessage` | — | no effect | no effect |
| Page's own service worker | — | unchanged (1 before, 1 after) | unchanged |
| Legitimate creative renders ("filled") | yes | **yes** | **yes** |

Headers measured from nginx in the port and subdomain runs:
- page `frame-src 'self' http://localhost:4175` (or `http://ads.localhost:4175`);
- ad frame `frame-ancestors 'self' http://localhost:4180`, and no `X-Frame-Options`.

¹ The test couldn't exercise `Domain=` cookies, because browsers reject `Domain=localhost`. On a real `ads.yonixtools.com`, the ad frame **could** set a cookie with `Domain=yonixtools.com` that the main site would then receive ("cookie tossing"). It still couldn't *read* the site's host-only cookies.

**Limits of this evidence (not a claim of complete security):**
- Local, simulated attacks on Chromium only. Not tested in WebKit/Safari or Firefox, and not with real Adsterra creatives.
- Browser bugs and future attack techniques aren't covered.
- Clickjacking-style deception inside the ad's own rectangle (a fake "Download" image, say) is a creative-content risk that isolation can't stop. Adsterra's content controls are the remedy.
- The port model was tested with `localhost` ports, and the subdomain model with `*.localhost`, which Chromium treats like real hosts for origin purposes.

## 3. Port 8443 vs a dedicated subdomain

| | `https://yonixtools.com:8443` | `https://ads.yonixtools.com` |
|---|---|---|
| DOM, URL box, code execution, redirects | isolated | isolated |
| localStorage / IndexedDB / service worker | isolated | isolated |
| Cookies | **shared**: the frame can read, overwrite and delete the site's non-HttpOnly cookies. Today that's only the 2-minute `ytx_dl_*` download-progress tokens, so the worst case is breaking the "download started" indicator | **isolated** for reading. The frame can still *set* `Domain=yonixtools.com` cookies (cookie tossing) |
| DNS change | none | an A record + certificate (needs your approval) |
| Firewall / edge | open 8443 + edge server block | edge server block on 443 (no new port) |
| Reachability | some corporate/public networks block non-443 ports: ads don't load there and slots collapse | standard port 443 |
| Ad network view | same hostname; the referrer carries the port | different hostname; the unit may need the subdomain added in the Adsterra dashboard |

**Recommendation:** use the subdomain for production. It gives better cookie isolation, uses port 443 and needs no new open port. Port 8443 is acceptable if you prefer no DNS change; its residual exposure is limited to the download-progress cookie.

## 4. Configuration

Applied at image build time by `deploy/nginx/apply-build-options.sh`, which is a no-op unless `AD_ORIGIN` is set.
- Inputs are validated against `^https?://host(:port)?$`.
- The build fails if a substitution doesn't apply.
- It refuses any blanket `https:` frame/script source or `unsafe-eval`.

Production `docker-compose.yml` does **not** pass `AD_ORIGIN`, so production can't enable it by accident.

```diff
# page CSP (security-headers.conf), only when AD_ORIGIN is set
-... connect-src 'self' data: blob:; worker-src 'self' blob:; ...
+... connect-src 'self' data: blob:; frame-src 'self' <AD_ORIGIN>; worker-src 'self' blob:; ...
# ad frame CSP (web.conf), only when AD_ORIGIN is set
-... frame-ancestors 'self'; ...
+... frame-ancestors 'self' <AD_FRAME_PARENT, default SITE_URL>; ...
```

**For production later (needs approval), one of:**
- **Subdomain:** DNS A record `ads.yonixtools.com` → droplet; certificate; an edge server block for `ads.yonixtools.com` that serves only `/ad-frame.html` and returns 404 for everything else; build with `AD_ORIGIN=https://ads.yonixtools.com`.
- **Port:** the `:8443` server block (same "only `/ad-frame.html`" rule), `ufw allow 8443/tcp`; build with `AD_ORIGIN=https://yonixtools.com:8443`.

**Staging needs neither.** Two quick tunnels give the site and the ad frame two different hostnames (see `STAGING_RUNBOOK.md`). In staging, the ad-frame hostname serves the whole staging site rather than only `/ad-frame.html`. That doesn't affect the frame isolation being tested.
