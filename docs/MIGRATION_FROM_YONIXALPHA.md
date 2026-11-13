# Replacing YonixAlpha with YoniXTools on the droplet

Source analysed: [`yonixnetwork/Yonix-Alpha`](https://github.com/yonixnetwork/Yonix-Alpha) @ `07d37d3` (29 Oct 2026). The server itself has **not** been inspected yet, so run step 1 before trusting this inventory.

## What YonixAlpha installs on the server

| Where | What | Removed by |
|---|---|---|
| `/opt/yonixalpha` | git checkout, `.env` (all secrets), `runtime/env-requests` | `purge` |
| Docker project `yonixalpha` | postgres 16, redis 7, api, web, crypto-trading, optional profiles (`memecoin`: data-solana, engine-solana-discovery, decision-engine, ml, paper-trading; `evm`: data-evm; `copy`: copy-engine; `legacy`: two engines), **reverse-proxy Nginx on host ports 80/443**, certbot | `stop` (containers) / `purge` (images) |
| Docker volumes | `yonixalpha_postgres_data` (all trading history), `_redis_data`, `_certbot_www`, `_certbot_conf` (yonixalpha.com certificates) | `purge` (backed up first) |
| systemd | `yonixalpha-env-updater.path` + `.service` (dashboard key updater, runs as root) | `stop` disables, `purge` deletes |
| cron (root) | `0 3 * * * /opt/yonixalpha/scripts/backup-db.sh` → `/opt/yonixalpha-backups`, `/var/log/yonixalpha-backup.log` | `stop` comments out, `purge` deletes |
| **Kept** (useful for YoniXTools) | Docker Engine and compose plugin, ufw (22/80/443), fail2ban, unattended-upgrades | — |

**Money and credentials involved:**
- A live Pump.fun wallet (`WALLET_PRIVATE_KEY` in `.env`).
- Exchange API keys for Bybit/Binance, stored encrypted in `crypto.api_connections`.
- `HELIUS_API_KEY`, `JUPITER_API_KEY`, `TELEGRAM_BOT_TOKEN`.
- The droplet's read-only deploy key on the Yonix-Alpha GitHub repository.

## The tools

- `deploy/scripts/yonixalpha-decommission.sh`: staged retirement.
  - `inventory` and `check` are read-only.
  - `backup` stops nothing; it includes a restore test and checksums.
  - `stop` is reversible with `restart` and keeps all data.
  - `purge` refuses unless the backup's checksums still match.
  - Every destructive stage requires a typed confirmation.
  - It was tested against a simulated droplet:
    - A live position blocks the run.
    - Stages refuse to run out of order.
    - A failed restore test is not accepted.
    - A wrong confirmation, or a trade opened after `check`, stops nothing.
    - A tampered backup blocks `purge`.
    - Unrelated cron jobs survive.
- `deploy/scripts/setup-edge-host.sh`: host Nginx plus Let's Encrypt for yonixtools.com.
  - It installs an HTTP-only site first, obtains the certificate, then switches to the full HTTPS config.
  - It refuses to run if ports 80/443 are taken or DNS doesn't point at the server.
- `deploy/scripts/preflight.sh`, `deploy.sh` and `smoke-test.sh`: as described in DEPLOYMENT.md.

## Runbook

Run everything as root on the droplet. Expect about one hour, plus DNS propagation.

**Day before**

1. At the DNS provider for yonixtools.com (Hostinger, unless you moved it), lower the TTL of the `@` and `www` records to 300 seconds.
2. Read-only audit:
   ```bash
   bash scripts/do-audit.sh > do-audit.txt 2>&1
   ```
   Review it (or share it) and confirm the inventory above.

**Migration**

3. Get the YoniXTools code onto the server, next to YonixAlpha; nothing changes yet:
   ```bash
   git clone https://github.com/yonixnetwork/yonixtools.git /opt/yonixtools
   cd /opt/yonixtools && git checkout feature/phase-1-redesign   # or main after merging
   bash deploy/scripts/yonixalpha-decommission.sh inventory
   ```
4. **Close live exposure.** In the YonixAlpha dashboard:
   - close every LIVE position and pending order, and any exchange-account trade;
   - switch every engine OFF.

   Then:
   ```bash
   bash deploy/scripts/yonixalpha-decommission.sh check    # must report no live exposure
   ```
5. **Back up and copy off the server:**
   ```bash
   bash deploy/scripts/yonixalpha-decommission.sh backup
   scp -r root@<droplet>:/root/yonixalpha-final-backup/<timestamp> ./   # run on YOUR computer
   ```
   Open the copy and check it's readable before continuing.
6. **Stop YonixAlpha.** This frees ports 80/443 and about 1–1.5 GB of RAM. yonixalpha.com goes offline here.
   ```bash
   bash deploy/scripts/yonixalpha-decommission.sh stop
   ```
7. **Deploy YoniXTools.** It binds only `127.0.0.1:8090`, so the public site is still served by Hostinger.
   ```bash
   cp services/downloader/.env.example services/downloader/.env   # review limits
   bash deploy/scripts/deploy.sh                                  # builds, health-checks, smoke-tests locally
   ```
8. **Verify the downloader against real platforms from this server.** This is the step that couldn't be done during development:
   ```bash
   cd services/downloader && python3 -m venv .venv && .venv/bin/pip install -q -r requirements-dev.txt
   RUN_LIVE_TESTS=1 LIVE_URL_INSTAGRAM_REEL=<url> LIVE_URL_TIKTOK_VIDEO=<url> LIVE_URL_FACEBOOK_REEL=<url> \
     LIVE_URL_X_VIDEO=<url> LIVE_URL_REDDIT_VIDEO=<url> LIVE_URL_PINTEREST_PIN=<url> LIVE_URL_YOUTUBE_SHORT=<url> \
     .venv/bin/pytest tests/test_live.py ; cat live-results.json
   ```
   If Instagram or YouTube block the droplet's IP, decide before switching DNS whether to launch with those platforms marked as limited.
9. **Switch DNS.** Point the `A` records for `yonixtools.com` and `www` at the droplet's IP. Remove any `AAAA` records unless the droplet has IPv6 configured. Wait until `getent hosts yonixtools.com` on the droplet shows its own IP.
10. **HTTPS:**
    ```bash
    DOMAIN=yonixtools.com EMAIL=<your email> bash deploy/scripts/setup-edge-host.sh
    SITE_HOST=yonixtools.com bash deploy/scripts/smoke-test.sh https://yonixtools.com
    ```
    During DNS propagation, some visitors still reach Hostinger, which is fine. There is a window of a few minutes, between the DNS switch and the certificate, when HTTPS to the droplet doesn't work yet.

**Rollback (until purge):** run `bash deploy/scripts/yonixalpha-decommission.sh restart` and point DNS back at Hostinger. First stop YoniXTools's edge with `systemctl stop nginx` (YonixAlpha needs ports 80/443), and stop its stack with `docker compose -f deploy/docker-compose.yml down` if memory is short.

**One to two weeks later, once YoniXTools is stable**

11. Permanently remove YonixAlpha. The verified backup is kept.
    ```bash
    bash deploy/scripts/yonixalpha-decommission.sh purge
    ```
12. **Revoke its credentials.** None of this is automatic:
    - **Wallet:** move any remaining SOL/tokens out of the `WALLET_PUBLIC_KEY` wallet to one you control, and treat that private key as retired. It still exists in your backup.
    - **Exchanges:** delete the API keys in your Bybit/Binance accounts (the `check` output lists the connections, e.g. `bybit/demo`).
    - **Helius / Jupiter:** rotate or delete the keys in their dashboards.
    - **Telegram:** in @BotFather, `/revoke` the bot token, or delete the bot.
    - **GitHub:** Yonix-Alpha → Settings → Deploy keys → remove the droplet's key. Optionally archive the repository.
13. Decide what yonixalpha.com should do (park, redirect or let it lapse). Its DNS still points at the droplet, where nothing will answer. Cancel Hostinger only when you're satisfied.

## Server sizing after migration

With YonixAlpha gone, the 2 vCPU / 2 GB droplet runs only YoniXTools:
- about 100 MB idle;
- about 1.2 GB peak with two concurrent downloads.

That is enough to start. Add 2 GB of swap, and watch `docker stats` and `/internal/stats` during the first weeks. Resize only if downloads queue up or memory runs short.
