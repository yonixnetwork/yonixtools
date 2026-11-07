# Phase 0 — Audit (2026-11-06)

Read-only inspection. No application code was changed.

## 1. Repository `yonixnetwork/yonixtools`

| Item | Finding |
|---|---|
| Default branch | `main` |
| History | 1 commit, `b24608f Initial commit` |
| Contents | `README.md` only (`# yonixtools`) |
| Existing tools / downloader code | **None in this repository** |

The code behind the current yonixtools.com, including the Instagram downloader
that you describe as broken, is **not in this repository**. The other repositories
on the account were checked too. `webcenta` is an empty "Initial commit". The rest
are trading projects.

## 2. Live site https://yonixtools.com

It could not be inspected. The build sandbox's network policy rejects connections
to `yonixtools.com` and `www.yonixtools.com` (proxy `CONNECT` 403 / DNS not
resolved). So the current page structure, tools, hosting and the actual
Instagram error are **unknown**. They have not been guessed.

## 3. DigitalOcean server (from the `Yonix-Alpha` repository's own docs)

No SSH or API access from this sandbox (`api.digitalocean.com` is also blocked).
The following comes from `Yonix-Alpha/docs/DEPLOYMENT.md`, `infra/` and
`scripts/`, and has **not** been checked on the live machine:

- Ubuntu 24.04 droplet, **2 vCPU / 2 GB RAM** (the docs mention BuildKit timeouts
  caused by this size).
- Domain `yonixalpha.com`. App directory `/opt/yonixalpha`, deployed with
  `scripts/deploy.sh` (git ff-pull, then `docker compose up -d --build`).
- Docker Compose stack: postgres 16, redis 7, `api`, `web`, plus up to 10 worker
  services (Solana/EVM data, engines, ML, paper/crypto trading) and certbot.
- **Nginx runs inside Docker (`reverse-proxy`) and binds host ports 80 and 443.**
  So YoniXTools cannot simply add a host-level Nginx. Port ownership must be
  decided first (see open decisions).
- `ufw` opens only 22, 80 and 443. `scripts/backup-db.sh` exists for Postgres.
- There is no mention of PM2. It may still be on the box, unverified.

`scripts/do-audit.sh` in this repository is a **read-only** script that collects
the real state: containers, ports, Nginx, certs, directories, resources and DNS.
Run it on the droplet to complete this part of the audit.

## 4. Downloader reference research

| Project | License | Last commit | Verdict |
|---|---|---|---|
| imputnet/cobalt | API **AGPL-3.0**, web **CC BY-NC-SA 4.0** | 2026-04-06 | Study only. Copying code would put YoniXTools under AGPL, and the web UI license forbids commercial use. Its Instagram service depends on cookies and session handling, which this project will not do. |
| DzarelDeveloper/OmniDL | **No license file** (all rights reserved) | 2026-09-10 | Study only. Do not copy. Useful patterns: a per-platform `extractors/` directory, an SSRF guard (`ipaddr.js` unicast check on resolved DNS, port and credential rejection), slot-based concurrency, temp-file cleanup, and a yt-dlp `InstagramIE` subclass that keeps image posts (yt-dlp alone drops them). |
| averygan/reclip | **MIT** | 2026-07-10 | Small Flask + yt-dlp CLI app (210 lines). Its job and status flow (`/api/info`, `/api/download`, `/api/status/<id>`, `/api/file/<id>`) is a good minimal model. It has no SSRF protection or rate limiting. MIT allows adaptation with attribution. |

Planned extraction stack: **yt-dlp** (Unlicense) for video, with **gallery-dl**
(GPL-2.0, run as a separate process) for image posts and carousels, and
**FFmpeg** (present here, 6.x) for muxing. No cookies, logins, DRM bypass or paid
APIs.

## 5. Testing constraint

From this sandbox, every target platform is blocked: instagram.com, youtube.com,
tiktok.com, facebook.com and x.com. Real extraction tests therefore **cannot
run here**. Offline unit tests (URL detection, SSRF guard, job queue, cleanup)
can. Live per-platform tests need one of these:
- the hosts allowed in this environment's network settings,
- the tests run in GitHub Actions,
- the tests run on the droplet.

Platforms also often block datacenter IPs, especially Instagram and YouTube.
Results from the droplet are what count.

## 6. Open decisions (blocking Phases 1 and 8)

1. **Existing site source.** Where does the current yonixtools.com live
   (another host, WordPress, a builder, another repo)? Without it, there is
   nothing to preserve, and Phase 1 is effectively a new build in this repo.
2. **Server state.** Run `scripts/do-audit.sh` on the droplet and share the
   output.
3. **Ports 80/443.** Either (a) YoniXTools gets its own `server` block inside
   Yonix-Alpha's Docker Nginx, or (b) a host-level proxy fronts both stacks.
   (b) is recommended once Yonix-Alpha is decommissioned.
4. **Capacity.** 2 GB RAM very likely cannot run the full trading stack plus
   yt-dlp/FFmpeg jobs. Either stop the trading workers (after a verified backup
   and your approval) or resize to 4 GB.
5. **Deploy access.** Use GitHub Actions over SSH (a deploy key stored as a
   repository secret), or deploy manually with the commands you run.

## 7. Proposed architecture (for approval, not yet built)

- `apps/web`: Next.js with **static generation** for every tool landing page.
  This repo holds a typed tool registry (slug, title, description, keywords,
  synonyms, category, FAQ, related tools), which drives the pages, search,
  sitemap and JSON-LD. Browser-only tools run entirely client-side.
- `services/downloader`: Python FastAPI app. The adapter registry is
  `detect(url) -> Adapter` (one module per platform; yt-dlp generic fallback
  restricted to an allowlist). It has an in-process bounded job queue with job
  IDs, progress over SSE, size and time limits, a temp directory per job with TTL
  cleanup, per-IP rate limiting, and an SSRF guard (domain allowlist plus a
  resolved-IP public-unicast check on every redirect hop). It has no database:
  jobs are ephemeral, which suits 2 GB.
- `deploy/`: Docker Compose, Nginx config, `.env.example`, and the deployment
  runbook.
