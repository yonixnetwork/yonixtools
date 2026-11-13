# Production release: Adsterra only, Monetag off

**Hostnames:**
- `yonixtools.com` is the main site.
- `ads.yonixtools.com` serves advertising documents only.

**Deployment:** not deployed yet. The owner runs the commands in §4 after reviewing them.

## 1. What this release contains

**Advertising**
- **Network:** Adsterra is the only active one. Every ad runs in an isolated frame on `ads.yonixtools.com`.
- **Placements:** at most two Adsterra ads in the page itself (plus the download pop-up's), from the central table `apps/web/src/lib/ads/placements.ts`:

| Page | Phone | Desktop |
|---|---|---|
| Home | 320×50 after the hero · 300×250 between Popular tools and Categories | 728×90 after the hero · 300×250 between sections |
| Utility tool | 320×50 below the introduction · 300×250 below the tool/result | 728×90 · 300×250 |
| Downloader | 320×50 below the downloader/results · 300×250 between How to use and Features | 728×90 · 300×250 |
| All tools; Developer and SEO categories (9+ tools) | full-width 320×50 after the first 6 tools · 300×250 after the list | 728×90 after 6 tools · native after the list |
| Shorter categories | 300×250 after the list | native after the list |

- **Download pop-up with an ad (owner request, 13 Nov):**
  - **When it appears:** after a visitor starts a download, on the downloader pages and on every browser tool (PDF, image, QR, video, text and so on).
  - **Downloaders:** the pop-up shows progress and Cancel/Hide, and the download starts as soon as the file is ready.
  - **Browser tools:** the file saves instantly, then the pop-up confirms it ("Download started").
  - **Ad:** one clearly labelled 300×250 Adsterra ad from the isolated origin. It loads once per page view, so repeated downloads don't refresh it.
  - **No waiting:** nothing waits for the ad, and there is no countdown.
  - **No popup, new tab or redirect:** none opens on Download; the pop-up is an on-page card the visitor can close.
  - **Counts:** the pop-up's ad is in addition to the page's two.
- **Never used:** Popunder, Smartlink, Social Bar.
- **Empty slots** collapse completely.

**Monetag**
- **Off:** both In-Page Push (12218944) and Vignette (12218952).
- **Setting:** `MONETAG`, default `off`, set by the administrator at deploy time.
- **What "off" means in practice:**
  - the public ad frame contains no Monetag code;
  - no page has a Monetag slot;
  - nothing Monetag is requested.
- **Admin pages:** `/ad-test.html` and `/admin/ads/` show both zones as **DISABLED**. They run only if the administrator opens a zone's own test.
- **To re-enable later:** deploy with `MONETAG=on`, and remove one Adsterra row on tool pages so they stay within two ads.

**Security, unchanged from 8f2b5fb:**
- **Ad documents:** `/ad-frame.html` and `/ad-test.html` return 404 on `yonixtools.com` and are served only on `ads.yonixtools.com`.
- **Ad test:** `/ad-test.html` needs the admin password.
- **Cookies:** the cookie guard is in place, and the download cookie is `__Host-` prefixed.
- **Page CSP:** unchanged. It frames exactly one origin, `https://ads.yonixtools.com`.

**Deploy tooling (new)**
- **`deploy.sh`:**
  - refuses any site other than `https://yonixtools.com` and any ad origin other than `https://ads.yonixtools.com`;
  - keeps the running images as `:previous` before building.
- **`rollback.sh`:** switches back to those images in seconds, with no rebuild. It's exercised in CI.
- **`release-check.sh`:** a read-only pre-deploy check.

## 2. Adsterra ad quality (gambling and unsuitable ads)

Category blocking happens in Adsterra's account, not in our code. Altering or filtering creatives ourselves could break the network's rules.

**What I found:**
- Adsterra's own help pages didn't turn up.
- Third-party reviews say publishers can block unwanted ad categories and specific advertisers by asking their **personal account manager**.
- The dashboard may also allow some of this; this needs confirming in your account.

**Suggested request to your Adsterra manager:**
> Please block gambling/betting, adult and dating categories, and any ads that imitate download or system buttons, for the site yonixtools.com and its ad subdomain ads.yonixtools.com.

**Sources** (secondary, not Adsterra documentation):
- [BlogPros review](https://blogpros.com/review-adsterra-earn-ads/)
- [Affroom review](https://affroom.com/ad-networks/reviews/adsterra/)
- [MonetizePros](https://realestate.monetizepros.com/ad-network-reviews/adsterra-review-for-publishers/)
- [Adsterra security blog](https://adsterra.com/blog/security-adsterra/)

## 3. What the deploy touches and what it doesn't

**`deploy.sh` touches only the `yonixtools` compose project:**
1. builds the two images;
2. recreates `yonixtools-web-1` and `yonixtools-downloader-1`;
3. re-applies the egress firewall;
4. runs the smoke test.

**It never touches:**
- **volumes:** `yonixtools_downloads` holds only short-lived download files;
- **YonixAlpha:** its containers, images, volumes (incl. `yonixalpha_postgres_data`) and backups;
- **DNS, certificates or the host nginx.**

**Image clean-up:** the final `docker image prune -f` removes only untagged images. `:latest` and `:previous` stay.

**Data:** YoniXTools has no database. Settings that must survive are:
- `services/downloader/.env`;
- `deploy/admin-auth/htpasswd`.

Both stay in place.

## 4. Exact production commands (run as root on the droplet, in this order)

```bash
# 0. Staging must have passed on THIS commit first, then free its space:
cd /opt/yonixtools-staging && bash deploy/scripts/staging-web.sh down

# 1. Production checkout: record what is running now (for rollback), then switch to the release
cd /opt/yonixtools
git status --short --untracked-files=no          # must print nothing
mkdir -p deploy/state && git rev-parse --short HEAD > deploy/state/deployed-rev   # e.g. c8725fb
git fetch origin
git checkout --detach origin/staging/ads-monetag
git rev-parse --short HEAD                       # must equal the release commit

# 2. Disk: the build needs room (only cached build steps are removed; no images, containers or volumes)
df -h /
docker builder prune -f                          # only if "Avail" is below 5G

# 3. Read-only release check (must end with "Release check passed.")
EXPECT_COMMIT=<release commit> bash deploy/scripts/release-check.sh

# 4. Deploy (Monetag stays off: MONETAG is not set)
AD_ORIGIN=https://ads.yonixtools.com bash deploy/scripts/deploy.sh
#   ends with the local smoke test (incl. ad-origin checks) and "Deploy complete: <commit>"

# 5. Public checks through the real domains
SITE_HOST=yonixtools.com bash deploy/scripts/smoke-test.sh https://yonixtools.com
curl -s -o /dev/null -w 'main /ad-frame.html: %{http_code} (expect 404)\n' https://yonixtools.com/ad-frame.html
curl -s -o /dev/null -w 'ads  /ad-frame.html: %{http_code} (expect 200)\n' https://ads.yonixtools.com/ad-frame.html
curl -s https://ads.yonixtools.com/ad-frame.html | grep -c 'nap5k\|n6wxm'     # expect 0 (no Monetag)
```

**Optional, with your separate approval** (production edge change): enable the admin ad test on production.
- `bash deploy/scripts/setup-ads-origin.sh https` installs the repo's `edge-ads-origin.conf`.
- It backs up the current file to `/root/nginx-backups`, runs `nginx -t` and rolls back automatically if that fails.
- Without it, `https://ads.yonixtools.com/ad-test.html` answers 404 (safe).

## 5. Rollback

**Fast, recommended:** back to the images that ran before, in seconds, with no rebuild.
```bash
cd /opt/yonixtools && bash deploy/scripts/rollback.sh
```
It recreates only the two YoniXTools containers from `:previous`. The new images are kept as `:failed` for inspection.

**Full:** back to the previous commit and rebuild.
```bash
cd /opt/yonixtools && git checkout --detach "$(cat deploy/state/previous-rev)" && AD_ORIGIN=https://ads.yonixtools.com bash deploy/scripts/deploy.sh
```

**Edge** (only if the optional step was run): restore the backed-up file from `/root/nginx-backups/yonixtools-ads.<timestamp>`, run `nginx -t`, then `systemctl reload nginx`.

## 6. After deploying: browser checks (phone and desktop)

1. Visit a page on yonixtools.com, a tool page (e.g. `/pdf-merger/`) and a downloader page (`/instagram-downloader/`). Each shows at most two ads, labelled "Advertisement", away from the tool.
2. A downloader: paste a public link, choose a quality. The file downloads, with no popup, new tab or ad.
3. Notification-style Monetag banners and full-screen overlays: none, anywhere.
4. With an ad blocker: no empty boxes, and the tools still work.
5. Install prompt and offline: as before.

## 7. Deploying future releases from GitHub ("Deploy (manual)" workflow)

The workflow was rewritten on 13 Nov 2026. The old version defaulted to `main`, deployed without `AD_ORIGIN` (no ads) and checked nothing.

**One-time setup (owner):**
1. Settings → Environments → **production** → add yourself as a **required reviewer**.
2. Add the environment secrets:

| Secret | Value |
|---|---|
| `DEPLOY_HOST` | the server's address |
| `DEPLOY_USER` | `root`: the server script writes backups to `/root/yonixtools-backups`, like the manual deploys |
| `DEPLOY_SSH_KEY` | a private key allowed to log in as that user |
| `DEPLOY_KNOWN_HOSTS` | output of `ssh-keyscan <host>` |
| `DEPLOY_PATH` | `/opt/yonixtools` |

3. Optional: put the search-engine verification codes in `/opt/yonixtools/deploy/production.env` on the server, so every deploy keeps them:
   ```
   GOOGLE_SITE_VERIFICATION=<code>
   BING_SITE_VERIFICATION=<code>
   ```
   Only these two keys are accepted. Anything else stops the deploy.

**To deploy a release:**
1. Merge it into `main` and wait for CI to be green.
2. Actions → **Deploy (manual)** → Run workflow. Enter the **full 40-character commit sha** twice. There is no default.
3. Approve the "production" environment when GitHub asks.

**What the workflow refuses, before anything changes:**
- a short, mistyped or unconfirmed sha;
- a commit not merged into `main`;
- a commit with no successful CI run;
- no reviewer approval.

**On the server**, `deploy/scripts/production-deploy.sh` runs. It is taken from `main`, never from the commit being deployed.

It refuses:
- a checkout that isn't `yonixnetwork/yonixtools`;
- a compose project other than `yonixtools`;
- a YonixAlpha path;
- a commit not merged into `main`;
- local changes;
- a missing `.env`, or `APP_ENV` not `production`;
- a missing admin password;
- a `production.env` line other than the two codes.

Then it:
1. backs up the configuration to `/root/yonixtools-backups/<date>-before-<commit>/`, with the previous commit and image IDs;
2. tags the running images `:rollback-<previous commit>`;
3. checks out the commit and runs `release-check.sh`, restoring the old checkout if that fails;
4. deploys with fixed settings: `https://yonixtools.com`, `AD_ORIGIN=https://ads.yonixtools.com`, Monetag off. The caller's environment can't change them.

**Finally**, the workflow checks the public site:
- sitemap XML and `robots.txt`;
- the ad frame is 404 on the main site;
- the Adsterra units are present and there is no Monetag code;
- the downloader API is healthy.

**Scope:** only the `yonixtools` compose project's two containers are rebuilt. No volumes, no YonixAlpha containers, images or data, and no DNS, firewall or host-nginx changes.

**Rollback:** `cd /opt/yonixtools && bash deploy/scripts/rollback.sh && git checkout --detach <previous commit>`. The `:rollback-<commit>` tags stay as a second way back.

**Read-only check on the server**, at any time. This runs every guard and changes nothing:
```bash
cd /opt/yonixtools && bash deploy/scripts/production-deploy.sh /opt/yonixtools "$(git rev-parse HEAD)" --dry-run
```
The script requires either `--dry-run` or `--deploy`. Without one of them it does nothing, so a forgotten flag can never deploy. The dry run updates only this checkout's `.git` (a fetch from GitHub).
```bash
# real deployment by hand (the GitHub workflow passes --deploy itself):
# bash deploy/scripts/production-deploy.sh /opt/yonixtools <full-commit-sha> --deploy
```

**Tests:** `deploy/tests/production-deploy-guards.sh` runs in CI and checks each refusal offline (27 cases).
