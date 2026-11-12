# Staging runbook: `staging/ads-monetag` (final)

**What it stages:**
- Adsterra on a separate ad-frame origin;
- Monetag on utility pages only, with the stage-1 CSP;
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

## 2. Separate staging folder

```bash
git worktree add /opt/yonixtools-staging origin/staging/ads-monetag
cd /opt/yonixtools-staging
```
Creates a second checkout. Production keeps running from `/opt/yonixtools` as it is.

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
MONETAG=on bash deploy/scripts/staging-web.sh up
```

**1. Generates a password.** Random, 24 characters, saved in `.staging/auth` (mode 600); only its hash goes to the proxy.

**2. Creates two staging networks.**
- `yonixtools-stg-pub` (172.30.98.0/24).
- `yonixtools-stg-int` (172.30.97.0/24, **internal: no internet access**).

**3. Builds `yonixtools-web:staging`.** Production's image tag isn't touched. The build-time security config is:
- page CSP `frame-src 'self' <ad tunnel>`;
- ad frame `frame-ancestors 'self' <site tunnel>`;
- `script-src`/`connect-src` gain `https://n6wxm.com https://nap5k.com`;
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
  - HTTP basic auth on everything, including `/ads-check/` and `/api/healthz`;
  - only the PWA manifest and icons are open, because browsers fetch them without credentials (static, public files);
  - limits: 120 page requests/min and 12 API requests/min per visitor, 30 API requests/min in total;
  - the password is stripped before forwarding;
  - noindex header on every response, and `robots.txt` = `Disallow: /`.
- **ad-frame origin (8093):** serves `/ad-frame.html` and nothing else (404).

**7. Verifies the setup.**
- **Gatekeeper checks:** 401 without the password, 200 with it, diagnostics and API locked, the ad origin serving only the frame, the noindex header.
- **Full smoke test through the password**, using the staging rules:
  - `robots.txt` must block everything;
  - Monetag hosts are allowed in the CSP;
  - the CSP must not be broadened beyond that.

**8. Prints the site URL, the `/ads-check/` URL and the login.**

## 6. Test

Use the checklist in `STAGING_TEST_REPORT.md` §C on Android Chrome, iPhone Safari and desktop Chrome, with and without an ad blocker. Don't click ads.
- **Log in** with the printed user and password. The browser asks once per site.
- **Downloader:** test-data mode returns a test clip for any link from a supported platform. URLs containing `private` or `blocked` show the matching error messages.
- **`/ads-check/` → Copy report:** send it to me. Its "blocked by this site's security policy" line lists any extra Monetag hosts. I'll turn them into an exact stage-2 diff for your approval.

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
