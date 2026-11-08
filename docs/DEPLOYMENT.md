# Deployment (DigitalOcean)

> **Nothing in this guide has been run against your server.** Every step needs your approval.
> The current production site stays on Hostinger until you switch DNS.

> **Replacing YonixAlpha on the droplet?** Follow [MIGRATION_FROM_YONIXALPHA.md](MIGRATION_FROM_YONIXALPHA.md): a step-by-step runbook with the decommission and edge-setup scripts. The sections below are the general reference.

## 0. Before anything: audit and back up (read-only)

1. Run the Phase 0 audit on the droplet and review the output: `bash scripts/do-audit.sh > do-audit.txt 2>&1`
2. Back up YonixAlpha. Its own runbook covers the database (`scripts/backup-db.sh` in the Yonix-Alpha repo). Also copy `/opt/yonixalpha/.env` and the certbot volume to somewhere off the server, and **verify the backup can be read** before changing anything.
3. Decide how the edge proxy will work (step 3). YonixAlpha's Docker Nginx currently owns ports 80 and 443.

## 1. Resources

| Component | Typical | Peak |
|---|---|---|
| web (Nginx) | ~10 MB | 128 MB limit |
| downloader API | ~80 MB | 1 GB container limit (2 concurrent downloads with FFmpeg merging) |
| Disk | ~2 GB images | plus up to `MAX_TEMP_USAGE_MB` (4 GB) of temporary downloads |

On a **2 GB / 2 vCPU** droplet that also runs the full YonixAlpha stack, memory will be tight. Either stop YonixAlpha's optional workers (with approval), resize to 4 GB, or lower `MAX_CONCURRENT_JOBS` to 1 and `DOWNLOADER_MEM_LIMIT` to `768m`. Add 2 GB of swap in any case. `deploy/scripts/preflight.sh` reports the real figures.

## 2. Install YoniXTools (isolated)

```bash
sudo mkdir -p /opt/yonixtools && sudo chown "$USER" /opt/yonixtools
git clone git@github.com:yonixnetwork/yonixtools.git /opt/yonixtools   # read-only deploy key
cd /opt/yonixtools && git checkout <release branch or tag>
cp services/downloader/.env.example services/downloader/.env          # review the limits
bash deploy/scripts/preflight.sh                                      # read-only
bash deploy/scripts/deploy.sh                                         # builds and starts compose project "yonixtools"
```

This publishes only `127.0.0.1:8090`. `deploy.sh` waits for both health checks and runs `deploy/scripts/smoke-test.sh` against the local stack. It never stops or modifies other containers.

## 3. Edge proxy and HTTPS (pick one, with approval)

- **Option A: keep YonixAlpha running.** Add `deploy/nginx/edge-yonixalpha-docker.conf` to YonixAlpha's Docker Nginx, plus `extra_hosts: ["host.docker.internal:host-gateway"]`, and issue a `yonixtools.com` certificate with its certbot service. This changes the YonixAlpha stack's configuration.
- **Option B: after YonixAlpha's proxy is retired (recommended).** Run `deploy/scripts/setup-edge-host.sh`. It installs host Nginx and certbot and applies `deploy/nginx/edge-host.conf`, which is compatible with Ubuntu 24.04's Nginx 1.24.

Both configs were validated with `nginx -t`, and the full chain (edge TLS → stack Nginx → API) was exercised locally with a self-signed certificate: 28 of 28 smoke checks passed.

## 4. DNS switch (with approval)

1. Lower the TTL of the `yonixtools.com` and `www` records at your DNS provider to 300 seconds, a day ahead.
2. Test the new server before switching: `RESOLVE="yonixtools.com:443:<droplet-ip>" SAMPLE_URL="<public post>" deploy/scripts/smoke-test.sh https://yonixtools.com`
3. Point the `A` records (and `AAAA`, if you use IPv6) at the droplet, then issue or renew the certificate.
4. Keep Hostinger running until the new site has been stable for a few days. Cancelling it is your decision.

## 5. Search Console

Set `GOOGLE_SITE_VERIFICATION=<token>` in the environment used by `docker compose build` (it's a build argument), redeploy, verify the domain property, then submit `https://yonixtools.com/sitemap.xml`.

## 6. Operations

| Task | Command |
|---|---|
| Logs | `docker compose -f deploy/docker-compose.yml logs -f downloader` (JSON events: `extract_failed`, `job_failed`… with platform, backend and code) |
| Extractor health | `docker compose -f deploy/docker-compose.yml exec downloader python -c "import urllib.request;print(urllib.request.urlopen('http://127.0.0.1:8787/internal/stats').read().decode())"` |
| Update yt-dlp (platforms change often) | Bump `yt-dlp` in `services/downloader/requirements.txt`, run the tests, then deploy |
| Rollback | `git checkout <previous commit> && bash deploy/scripts/deploy.sh` |
| Stop YoniXTools only | `docker compose -f deploy/docker-compose.yml down` (keeps other stacks; add `-v` to also drop temporary downloads) |

### GitHub Actions deploy (optional)

`.github/workflows/deploy.yml` runs only when started manually, and only after approval for the `production` environment. It needs these secrets: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS` and `DEPLOY_PATH`. Use a dedicated deploy user, not root.

## 7. Testing the downloader reliability upgrade on the droplet (with approval)

This upgrade is on `feature/downloader-reliability`. The droplet runs `feature/phase-1-redesign` (`c1b070c`), which is also the rollback point.

```bash
cd /opt/yonixtools
git fetch origin
git checkout feature/downloader-reliability   # new code; images are rebuilt (adds Deno and curl_cffi)
bash deploy/scripts/deploy.sh                 # rebuilds, restarts, re-applies the egress firewall, smoke-tests
SITE_HOST=yonixtools.com bash deploy/scripts/smoke-test.sh https://yonixtools.com
bash deploy/scripts/diagnose-platforms.sh     # real downloads from THIS server's IP, every platform
bash deploy/scripts/diagnose-platforms.sh youtube 'https://www.youtube.com/watch?v=…'   # your own links
```

If the droplet's results differ from `apps/web/src/lib/downloader/platform-status.ts` (for example, YouTube works from the droplet's IP), update that file from the evidence and redeploy.

To roll back:

```bash
git checkout feature/phase-1-redesign && bash deploy/scripts/deploy.sh
```


## 8. Testing the media expansion on the droplet (with approval)

`feature/media-expansion` builds on what production runs now (`feature/downloader-reliability`, `c259dfc`). That production branch is the rollback point.

```bash
cd /opt/yonixtools
git fetch origin
git checkout feature/media-expansion
bash deploy/scripts/deploy.sh
SITE_HOST=yonixtools.com bash deploy/scripts/smoke-test.sh https://yonixtools.com
bash deploy/scripts/diagnose-platforms.sh            # every platform from the droplet's IP
bash deploy/scripts/diagnose-platforms.sh instagram 'https://www.instagram.com/p/BoHk1haB5tM/'
```

Then check by hand on an Android phone in Chrome:

1. Paste an Instagram carousel link: every photo should be shown.
2. Tap Download on one photo.
3. Tick two photos and tap ZIP.
4. Both files should appear in Downloads.

To roll back:

```bash
git checkout feature/downloader-reliability && bash deploy/scripts/deploy.sh
```
