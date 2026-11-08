# Staging runbook: `staging/ads-monetag`

What it stages:
- Adsterra on a separate ad-frame origin;
- Monetag on allowed utility pages only, with the stage-1 CSP;
- everything else as in production.

**Doesn't change:** production containers or images, the edge proxy, DNS, firewall, the production service worker or the live site.
**Opens no port:** the staging container listens on `127.0.0.1:8091` only and is reached through two outbound Cloudflare quick tunnels.

Run on the droplet as root, one step at a time. Each command is explained before you run it.

### 0. Check disk space (the root disk was 96.9% full)

```bash
df -h /
docker system df
```
Read-only. Shows free space and how much Docker uses for images and build cache. The staging image build needs roughly 1–2 GB free.

If space is short:
```bash
docker builder prune -f
```
Deletes **only the Docker build cache**: intermediate layers from earlier builds. Running containers, images and volumes (production included) are untouched. The next production build will just take a little longer.

### 1. Get the staging code without touching production's checkout

```bash
cd /opt/yonixtools
git fetch origin staging/ads-monetag
```
Downloads the branch. Doesn't change any files production uses.

```bash
git worktree add /opt/yonixtools-staging origin/staging/ads-monetag
```
Creates a **separate folder** with the staging code. Production keeps running from `/opt/yonixtools` as it is.

If the folder already exists from an earlier staging run, use this instead:
```bash
cd /opt/yonixtools-staging && git checkout --detach origin/staging/ads-monetag
```

```bash
cd /opt/yonixtools-staging
```

### 2. Start the two tunnels (public URLs, no open port)

```bash
bash deploy/scripts/staging-web.sh tunnels
```
- Downloads the `cloudflare/cloudflared` image once and starts two small containers: `yonixtools-web-staging-tunnel-site` and `yonixtools-web-staging-tunnel-ads`.
- Each opens an **outbound** connection to Cloudflare and gets a random `https://<words>.trycloudflare.com` address that forwards to `127.0.0.1:8091` on the droplet.
- No account, no DNS record, no firewall change.
- It prints both URLs and saves them in `.staging-urls` inside the staging folder.
- Anyone who knows these random URLs can open staging while it runs.

### 3. Build and start staging

```bash
MONETAG=on bash deploy/scripts/staging-web.sh up
```
- **Builds** the image `yonixtools-web:staging` from the staging folder. Production's `yonixtools-web:latest` is not touched.
- Build options:
  - the ad-frame origin is the second tunnel;
  - Monetag is on, on utility pages only;
  - the nginx CSP gets exactly: `frame-src 'self' <ad tunnel>` and `frame-ancestors 'self' <site tunnel>` on the ad frame, plus `https://n6wxm.com https://nap5k.com` in `script-src` and `connect-src`.
- **Runs** it as container `yonixtools-web-staging` on `127.0.0.1:8091`:
  - read-only, 128 MB memory, half a CPU;
  - joined to the production stack's private network **only** so that `/api/` reaches the existing downloader. Staging downloads use the production downloader.
- **Smoke test:** runs it against staging with `STAGING=1`.
  - The `/api` checks should pass.
  - Expect a NOTE that the page CSP includes the Monetag stage-1 hosts.
  - The step itself never fails.
- Prints the staging URL and the `/ads-check/` URL.

### 4. Check, test, stop

```bash
bash deploy/scripts/staging-web.sh status
```
Read-only: shows the tunnel URLs and the staging containers.

```bash
bash deploy/scripts/staging-web.sh down
```
Removes the staging container, both tunnels, the staging image and `.staging-urls`. Production is unaffected.

```bash
cd /opt/yonixtools && git worktree remove /opt/yonixtools-staging
```
Removes the staging folder.

### Notes

- **Quick-tunnel URLs change every time `tunnels` runs.** Run `up` again afterwards, because the build bakes in the ad-frame URL.
- **Ad networks may serve nothing to `*.trycloudflare.com`.** Adsterra and Monetag units are registered for yonixtools.com. "Script loaded, no creative" on staging is then a domain/fill question, not an integration failure. The real-domain evidence for Adsterra is your saved `/ads-check/` page.
- **Rate limits:** every staging visitor reaches the API through the tunnel, so you share one rate-limit bucket.
