# Staging runbook: `staging/ads-monetag` (final)

> **Order and gates.** Run **only section 1** first and send me its output: it is read-only. Continue to section 2 only after I've confirmed there is enough safe space. The previous login banner showed `/` at 96.9% (about 2.7 GB free), which is below the 6 GB the build and a rollback need. `staging-web.sh` refuses to start below that. No cleanup is run by any script.

**What it stages:**
- Adsterra on a separate ad-frame origin;
- Monetag In-Page Push on utility pages only, in the same isolated ad-origin frames (Vignette disabled);
- the admin-only ad test page `/admin/ads/`;
- everything else as in production.

**What it never touches:**
- production containers, images, volumes, `.env`, the `yonixtools_stack` network;
- the edge proxy, the firewall's open ports, DNS;
- the production service worker and the live site;
- YonixAlpha.

**Production deployment is not part of this runbook** and needs your separate approval.

Run on the droplet as root, one section at a time. Every command is explained before you run it. Commands marked **read-only** change nothing.

---

## 1. Disk space

```bash
cd /opt/yonixtools && git fetch origin staging/ads-monetag
git show origin/staging/ads-monetag:deploy/scripts/disk-report.sh > /tmp/disk-report.sh
bash /tmp/disk-report.sh
```
- `git fetch` downloads the branch without changing production's files.
- `git show … > /tmp/…` copies just the report script to `/tmp`.
- The report itself is **read-only**. It shows:
  - free disk and inodes, with a PASS/WARN against the 6 GB needed;
  - Docker images by size, marked RUNNING / unused / dangling;
  - build cache size;
  - volumes, **listed only, never to be deleted**;
  - the largest container logs, the system journal, package caches and the largest folders;
  - the cleanup it *proposes*. It runs none of it.

**Space needed:** about 2–2.5 GB for the staging build (npm dependencies ~0.8 GB plus the build cache; final image ~70 MB) and about 0.2 GB for the proxy and tunnel images. Keep at least as much again free for a production rollback build. Preflight requires **≥ 6 GB free**.

**Cleanup, only if the report says WARN.** Send me the report first and I'll tell you which, if any, to run:

| Command | Removes | Consequences |
|---|---|---|
| `docker builder prune -f --filter until=168h` | build cache older than 7 days, for **all** projects incl. YonixAlpha | next builds take longer. No running container, image or volume is affected |
| `docker image prune -f` | dangling `<none>` images only (not tagged, not used by any container) | none functionally. Our rollback method rebuilds from git rather than re-tagging old images |
| `journalctl --vacuum-size=300M` | oldest system journal entries beyond 300 MB | older system log history is gone |
| `apt-get clean` | downloaded `.deb` package files | none; they're re-downloaded if needed |

**Never** run `docker volume prune`, `docker system prune -a` or `docker image prune -a` (they could remove YonixAlpha's images or data), and never delete files under `/var/lib/docker` or `/opt` by hand.

## 2. Separate staging folder, exact commit

```bash
cd /opt/yonixtools && git fetch origin staging/ads-monetag
git worktree add /opt/yonixtools-staging origin/staging/ads-monetag
cd /opt/yonixtools-staging
git rev-parse --short HEAD      # must equal the commit in Claude's report
git status --porcelain          # must print nothing
```
- Creates a second checkout. Production keeps running from `/opt/yonixtools` unchanged.
- If `/opt/yonixtools-staging` already exists, use `cd /opt/yonixtools-staging && git fetch origin && git checkout --detach origin/staging/ads-monetag` instead.

## 3. Preflight (read-only)

```bash
bash deploy/scripts/staging-web.sh preflight
```
Checks:
- Docker is available;
- **≥ 6 GB disk** and **≥ 1.5 GB memory + swap**, so the build can't starve production;
- the production downloader *image* exists (staging reuses it read-only, never rebuilds it);
- ports `127.0.0.1:8092/8093` are free;
- the staging subnets `172.30.97.0/24` and `172.30.98.0/24` aren't used by anything else;
- no name clashes.

`up` repeats these checks and won't start anything if one fails.

## 4. Tunnels

```bash
bash deploy/scripts/staging-web.sh tunnels
```
Starts two small containers, `yonixtools-stg-tunnel-site` and `yonixtools-stg-tunnel-ads`.
- **Outbound only:** each makes an outbound connection to Cloudflare and gets a random `https://<words>.trycloudflare.com` address. No port is opened, and there's no account and no DNS.
- **Only the gatekeeper:** the tunnels forward only to the staging gatekeeper on `127.0.0.1:8092` (site) and `127.0.0.1:8093` (ad frame).
- **Prints both URLs.** Nothing is served until step 5.

## 5. Build and start

```bash
EXPECT_COMMIT=<commit from Claude's report> bash deploy/scripts/staging-web.sh up   # Monetag off, like production
```
Refuses to build if the checkout has changes or isn't exactly that commit.

**1. Generates a password.** Random, 24 characters, saved in `.staging/auth` (mode 600); only its hash goes to the proxy.

**2. Creates two staging networks.**
- `yonixtools-stg-pub` (172.30.98.0/24).
- `yonixtools-stg-int` (172.30.97.0/24, **internal: no internet access**).

**3. Builds `yonixtools-web:staging`.** Production's image tag isn't touched. The build-time security config is:
- page CSP `frame-src 'self' <ad tunnel>`;
- ad frame `frame-ancestors 'self' <site tunnel>`;
- nothing else.

**4. Starts the staging backend** `yonixtools-stg-downloader` from the existing production image, in **test-data mode**:
- platforms are simulated by the repo's `fake_worker.py` and media is a generated 5-second test video;
- it's on the internal network only, so it **can't reach the internet**, any platform or production;
- **no production `.env`**: only the explicit staging settings shown in the script;
- no volumes (temp files in a 256 MB tmpfs);
- read-only filesystem, all Linux capabilities dropped, 384 MB memory, half a CPU;
- strict limits: 1 job at a time, 3 queued, 6 extractions and 3 downloads per minute, files kept 5 minutes.

**5. Starts the staging web** `yonixtools-stg-web`. It talks only to the staging backend and isn't reachable from outside except through the gatekeeper.

**6. Starts the gatekeeper** `yonixtools-stg-proxy` (`deploy/staging/proxy.conf`) on `127.0.0.1` only:
- **site (8092):**
  - HTTP basic auth on everything, including `/admin/ads/` and `/api/healthz`;
  - only the PWA manifest and icons are open, because browsers fetch them without credentials (static, public files);
  - limits: 120 page requests/min and 12 API requests/min per visitor, 30 API requests/min in total;
  - the password is stripped before forwarding;
  - noindex header on every response, and `robots.txt` = `Disallow: /`.
- **ad-frame origin (8093):** serves the public `/ad-frame.html` and the admin-only `/ad-test.html` (staging password here, then the web container checks the admin login again), and nothing else (404).

**7. Verifies the setup and fails loudly** (exit 1, "SOME CHECKS FAILED") if anything below is wrong.
- **Isolation, proven on the server:**
  - no staging container is on production's `yonixtools_stack` network;
  - the staging backend is on the internal (no-internet) network only, with nothing mounted except the test worker (no volumes, no production `.env`);
  - a sample extraction returns the simulated "Test clip", so the downloader answers from the staging backend;
  - production's web and downloader containers have the same IDs, start times and restart counts before and after.
- **Gatekeeper checks:** 401 without the password, 200 with it, diagnostics and API locked, the noindex header.
- **Ad documents (Gap 1 / Gap 2):**
  - the site origin answers 404 for `/ad-frame.html`, `/ad-test.html` and `/ad-frame.html?u=native`;
  - the ad origin serves `/ad-frame.html`, both locally and through its tunnel, and the frame contains no diagnostics;
  - `/ad-test.html` answers 401 without the password (with or without a query), 200 with the login, and is never cached;
  - the ad origin serves nothing else (404).
- **Full smoke test through the password**, using the staging rules:
  - `robots.txt` must block everything;
  - the page CSP allows no ad host at all, only the one ad-origin frame;
  - `/admin/ads/` needs the login, and `/ads-check/` is gone (404);
  - the CSP must not be broadened beyond that.

**8. Prints the site URL, the admin ad test URL (`/admin/ads/`), the ad-origin test URL (`<ads tunnel>/ad-test.html`) and the login.** In staging, the staging login is also the admin login.

## 6. Test

Use the checklist in `STAGING_TEST_REPORT.md` §C on Android Chrome, iPhone Safari and desktop Chrome, with and without an ad blocker. Don't click ads.
- **Log in** with the printed user and password. The browser asks once per site.
- **Downloader:** test-data mode returns a test clip for any link from a supported platform. URLs containing `private` or `blocked` show the matching error messages.
- **`/admin/ads/` → Copy report** (admin only): each format loads the public ad frame like a real slot and reports AD RENDERED, EMPTY or BLOCKED. Send me the report from each device.
- **`<ads tunnel>/ad-test.html` → Copy report** (asks for the login again, because it's on the ad origin): every format framed, with script loaded / network requests / blocked / script errors.
- **Monetag top-level:** on that page, tap **open top-level** next to *Monetag In-Page Push (zone 12218944)*, then the Vignette one. Each opens a separate document on the ad origin (never on the site) and shows its status at the bottom. Wait about a minute, then send me that text.
  - CREATIVE RENDERED top-level but not framed: the zone refuses frames.
  - NO CREATIVE RETURNED in both: no fill, or the domain isn't approved. A temporary trycloudflare address isn't registered with Monetag, so an empty result on staging is expected and doesn't settle it; a rendered one does.
- **Check that diagnostics stay private:** open `<ads tunnel>/ad-test.html` in a private window. It must ask for a password. Open `<ads tunnel>/ad-frame.html?u=monetagPush&s=admin-top`: the page must stay blank. Open `<site>/ad-frame.html`: it must be "not found".

```bash
bash deploy/scripts/staging-web.sh status
```
**Read-only:** URLs and staging container states.

## 7. Stop and remove everything (rollback)

```bash
bash deploy/scripts/staging-web.sh down
cd /opt/yonixtools && git worktree remove /opt/yonixtools-staging
```
- `down` removes both tunnels (the URLs stop working immediately), the gatekeeper, the staging web, the staging backend, both staging networks, the `yonixtools-web:staging` image, the password and the URL file.
- If live mode was used, it also removes only the staging firewall chain.
- The second command deletes the staging checkout.

Production needs no rollback: nothing in it changed. If the build or `up` fails halfway, `down` is still the cleanup.

---

## Optional: real extraction (`BACKEND=live`): only after you approve it separately

`CONFIRM_LIVE=yes BACKEND=live MONETAG=on bash deploy/scripts/staging-web.sh up` runs the staging backend with the real worker.

**Safeguards:**
- separate container, no production `.env` or volumes;
- its **own** egress firewall chain `YONIXTOOLS-STG-EGRESS` for 172.30.98.0/24. It blocks private, metadata and host addresses. The script refuses to touch production's chain;
- limits: 1 job and 1 extraction at a time, 3 queued, 6 extractions and 3 downloads per minute, ≤ 100 MB, ≤ 15 min of media, 3-minute job timeout;
- files deleted after 5 minutes.

**Remaining risks of live mode:**
- **Shared IP:** it uses the server's IP, the same one production uses. Heavy testing could make a platform rate-limit or block that IP for production too.
- **Shared resources:** it takes CPU and memory from the same server, though capped at half a CPU and 768 MB.
