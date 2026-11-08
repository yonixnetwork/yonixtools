# Proposal: isolate the Adsterra frame on its own origin (needs your approval)

## Why

Measured on 8 Nov 2026 (`ADS_FIX_TEST_REPORT.md` §5):
- In the opaque-origin sandbox, Adsterra's code fails and no ad renders.
- In a same-origin frame, ads render, but a hostile creative can read the page and, through the page's existing `'unsafe-inline'`, **redirect the whole page**.

On a **separate origin we own**, the frame keeps `allow-same-origin` for *its own* origin. That gives Adsterra cookies, storage and service worker there, while the browser blocks all access to the page.

## Evidence (local, stubbed ad scripts, `apps/web/scripts/ads/verify-isolation.mjs`)

Site on `http://localhost:4180`, ad frame on `http://127.0.0.1:4175`: different origins, as `:8443` would be in production.

| From inside the ad frame | Same-origin frame (feature/ads-fix) | Separate origin (this branch) |
|---|---|---|
| Read the page DOM | possible | **blocked** |
| Inject and run code in the page | runs | **blocked** |
| Redirect the page | **redirected** | **blocked** (page URL unchanged) |
| `top.location = …` | blocked | blocked |
| Own cookies / storage (what Adsterra needs) | ok | ok |
| Simulated creative fills the slot | yes | **yes** ("filled", cross-origin report accepted) |

## Exact changes to approve (none applied yet)

Option A uses `https://yonixtools.com:8443`: the same hostname and existing certificate, with **no DNS change**. With option B, replace it everywhere with `https://ads.yonixtools.com` and add a DNS A record plus certificate.

**1. Page CSP** (`deploy/nginx/security-headers.conf`): allow framing exactly that one origin. Today frames fall back to `default-src 'self'`.
```diff
-... connect-src 'self' data: blob:; worker-src 'self' blob:; frame-ancestors 'none'; ...
+... connect-src 'self' data: blob:; frame-src 'self' https://yonixtools.com:8443; worker-src 'self' blob:; frame-ancestors 'none'; ...
```

**2. Ad frame CSP** (`deploy/nginx/web.conf`, `location = /ad-frame.html`): let the main site embed it from the other origin.
```diff
-... frame-ancestors 'self'; form-action https:; ...
+... frame-ancestors 'self' https://yonixtools.com; form-action https:; ...
```

**3. Edge proxy** (host Nginx, next to the existing `yonixtools.com` server block): a TLS listener that serves **only** the ad frame.
```nginx
server {
    listen 8443 ssl http2;
    listen [::]:8443 ssl http2;
    server_name yonixtools.com;
    server_tokens off;
    ssl_certificate     /etc/letsencrypt/live/yonixtools.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yonixtools.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    location = /ad-frame.html {
        proxy_pass http://127.0.0.1:8090;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto https;
    }
    location / { return 404; }
}
```

**4. Firewall:** `ufw allow 8443/tcp`, plus the DigitalOcean cloud firewall if one is attached.

**5. Build:** `AD_ORIGIN=https://yonixtools.com:8443` (already wired through compose, the Dockerfile and `staging-web.sh` on this branch; empty by default).

**Residual risk:**
- Cookies are not port-isolated, so the frame can read this site's non-HttpOnly cookies. Today those are only the short-lived download-progress tokens. Option B avoids this.
- A few restrictive networks block non-443 ports. On those, ads won't load and slots collapse.

## Staging the isolated variant

The staging site must also be on yonixtools.com, so ad networks treat it as the real site. Proposed (approval needed, temporary):
- the edge serves staging at `https://yonixtools.com:8444` → `127.0.0.1:8091`;
- `ufw allow 8444/tcp`;
- the ad frame's `frame-ancestors` gains `https://yonixtools.com:8444` for the duration.

Remove all three after the test.
