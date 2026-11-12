#!/usr/bin/env bash
# YoniXTools STAGING on the droplet, next to production and isolated from it.
# Full runbook with an explanation of every step: docs/STAGING_RUNBOOK.md
#
#   bash deploy/scripts/staging-web.sh preflight       # read-only checks (disk, memory, ports, names)
#   bash deploy/scripts/staging-web.sh tunnels         # two temporary public HTTPS URLs (no open port)
#   MONETAG=on bash deploy/scripts/staging-web.sh up   # build + start staging (test-data backend)
#   bash deploy/scripts/staging-web.sh status
#   bash deploy/scripts/staging-web.sh down            # remove everything staging created
#
# Isolation from production:
#  - own containers (yonixtools-stg-*), own networks (172.30.97.0/24 internal, 172.30.98.0/24),
#    own image tag (yonixtools-web:staging); production containers, images, volumes, network,
#    .env, edge proxy, firewall and DNS are never touched.
#  - own downloader backend from the existing production image (read-only use, no rebuild):
#      BACKEND=test (default): simulated platforms (repo's tests/fake_worker.py), NO internet
#        access at all (Docker --internal network), no production configuration or secrets.
#      BACKEND=live (needs CONFIRM_LIVE=yes): real extraction with strict limits and its own
#        egress firewall chain; see the runbook for the risks.
#  - the tunnels reach only a password-protected gatekeeper proxy (deploy/staging/proxy.conf).
set -euo pipefail
cd "$(dirname "$0")/../.."
P=yonixtools-stg
NET_PUB=$P-pub; SUB_PUB=172.30.98.0/24
NET_INT=$P-int; SUB_INT=172.30.97.0/24
SITE_PORT=8092; ADS_PORT=8093
ST=.staging          # state: tunnel URLs, password (git-ignored, mode 700)
BACKEND="${BACKEND:-test}"
EGRESS_CHAIN=YONIXTOOLS-STG-EGRESS
ok() { echo "  PASS  $1"; }; bad() { echo "  FAIL  $1"; FAILED=1; }; note() { echo "  NOTE  $1"; }

preflight() {
  FAILED=0
  echo "Preflight (read-only)"
  docker info >/dev/null 2>&1 && ok "docker available" || { bad "docker not available"; return 1; }
  free_kb=$(df -Pk /var/lib/docker 2>/dev/null | awk 'NR==2{print $4}'); free_gb=$(( ${free_kb:-0} / 1048576 ))
  [ "$free_gb" -ge 6 ] && ok "disk: ${free_gb} GB free (need >= 6 GB: staging build + a production rollback build)" || bad "disk: only ${free_gb} GB free (need >= 6 GB); see runbook section 1"
  avail_mb=$(awk '/MemAvailable/{a=$2} /SwapFree/{s=$2} END{print int((a+s)/1024)}' /proc/meminfo)
  [ "$avail_mb" -ge 1500 ] && ok "memory: ${avail_mb} MB available incl. swap (need >= 1500 MB for the build)" || bad "memory: only ${avail_mb} MB available incl. swap (need >= 1500 MB)"
  docker image inspect yonixtools-downloader:latest >/dev/null 2>&1 && ok "production downloader image present (reused read-only, not rebuilt)" || bad "image yonixtools-downloader:latest missing"
  for port in $SITE_PORT $ADS_PORT; do
    if ss -ltnH "sport = :$port" 2>/dev/null | grep -q .; then docker ps --format '{{.Names}}' | grep -qx "$P-proxy" && note "port $port used by staging itself" || bad "port 127.0.0.1:$port already in use"; else ok "port $port free"; fi
  done
  used=$(docker network ls -q | xargs -r docker network inspect -f '{{.Name}} {{range .IPAM.Config}}{{.Subnet}} {{end}}' 2>/dev/null | grep -v "^$P-" || true)
  echo "$used" | grep -qE "172\.30\.9[78]\.0/24" && bad "subnet 172.30.97.0/24 or 172.30.98.0/24 already used by another network" || ok "staging subnets free"
  others=$(docker ps -a --format '{{.Names}}' | grep -E "^$P-" | grep -vE "^$P-(web|downloader|proxy|tunnel-site|tunnel-ads)$" || true)
  [ -z "$others" ] && ok "no name clashes" || bad "unexpected containers named $P-*: $others"
  docker ps --format '{{.Names}}' | grep -q '^yonixtools-web-1$' && note "production web running (not touched)" || note "production web not running"
  [ "$FAILED" = 0 ]
}

tunnel() { # name port
  docker rm -f "$1" >/dev/null 2>&1 || true
  docker run -d --name "$1" --network host --restart no --memory 128m cloudflare/cloudflared:latest tunnel --no-autoupdate --url "http://127.0.0.1:$2" >/dev/null
  for _ in $(seq 1 45); do u="$(docker logs "$1" 2>&1 | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | head -1)"; [ -n "$u" ] && { echo "$u"; return; }; sleep 1; done
  echo "no URL from $1 (docker logs $1)" >&2; exit 1
}

start_backend() {
  local common=(--read-only --cap-drop ALL --security-opt no-new-privileges:true --pids-limit 128 --restart no
    -e TRUST_PROXY_HEADERS=1 -e CORS_ORIGINS="$SITE" -e TEMP_ROOT=/tmp/jobs
    -e MAX_CONCURRENT_JOBS=1 -e MAX_CONCURRENT_EXTRACTIONS=1 -e MAX_QUEUED_JOBS=3 -e MAX_ACTIVE_JOBS_PER_CLIENT=1
    -e RATE_WINDOW_SECONDS=60 -e RATE_EXTRACT_PER_WINDOW=6 -e RATE_JOBS_PER_WINDOW=3
    -e FILE_TTL_SECONDS=300 -e JOB_TTL_SECONDS=600)
  if [ "$BACKEND" = test ]; then
    docker run -d --name "$P-downloader" --network "$NET_INT" --network-alias downloader "${common[@]}" \
      --tmpfs /tmp:size=256m --memory 384m --cpus 0.5 \
      -v "$PWD/services/downloader/tests/fake_worker.py:/stg/fake_worker.py:ro" \
      -e APP_ENV=test -e WORKER_COMMAND="python /stg/fake_worker.py" -e YTX_FAKE_MEDIA=/tmp/sample.mp4 \
      -e MIN_FREE_DISK_MB=1 -e MAX_TEMP_USAGE_MB=150 \
      yonixtools-downloader:latest sh -c 'ffmpeg -loglevel error -f lavfi -i testsrc=size=640x360:rate=25 -f lavfi -i sine=frequency=440 -t 5 -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest /tmp/sample.mp4 && exec uvicorn app.asgi:app --host 0.0.0.0 --port 8787 --workers 1 --no-server-header' >/dev/null
  elif [ "$BACKEND" = live ]; then
    [ "${CONFIRM_LIVE:-}" = yes ] || { echo "BACKEND=live makes real requests to the platforms from this server's IP (shared with production). Read the runbook, then set CONFIRM_LIVE=yes."; exit 1; }
    YONIXTOOLS_SUBNET="$SUB_PUB" YONIXTOOLS_EGRESS_CHAIN="$EGRESS_CHAIN" bash deploy/scripts/egress-firewall.sh
    docker run -d --name "$P-downloader" --network "$NET_PUB" "${common[@]}" \
      --tmpfs /tmp:size=400m --memory 768m --cpus 0.5 \
      -e APP_ENV=production -e MAX_FILESIZE_MB=100 -e MAX_DURATION_SECONDS=900 -e EXTRACT_TIMEOUT_SECONDS=45 \
      -e JOB_TIMEOUT_SECONDS=180 -e MIN_FREE_DISK_MB=50 -e MAX_TEMP_USAGE_MB=300 -e MAX_ITEMS_PER_POST=10 \
      yonixtools-downloader:latest >/dev/null
    docker network connect --alias downloader "$NET_INT" "$P-downloader"
  else echo "BACKEND must be test or live" >&2; exit 2; fi
}

case "${1:-}" in
  preflight) preflight ;;
  tunnels)
    mkdir -p "$ST"; chmod 700 "$ST"
    site="$(tunnel "$P-tunnel-site" "$SITE_PORT")"; ads="$(tunnel "$P-tunnel-ads" "$ADS_PORT")"
    printf 'SITE=%s\nADS=%s\n' "$site" "$ads" > "$ST/urls"
    echo "Site (password-protected): $site"
    echo "Ad-frame origin (serves /ad-frame.html only): $ads"
    echo "Nothing is served until 'up' finishes. Next: MONETAG=on bash deploy/scripts/staging-web.sh up"
    ;;
  up)
    preflight || { echo "Preflight failed: nothing started."; exit 1; }
    # Exact, clean code only: refuse a dirty checkout or a different commit than requested.
    [ -z "$(git status --porcelain --untracked-files=no)" ] || { echo "Working tree has changes: refusing (git status)."; exit 1; }
    head="$(git rev-parse HEAD)"
    if [ -n "${EXPECT_COMMIT:-}" ]; then case "$head" in "$EXPECT_COMMIT"*) ok "commit $EXPECT_COMMIT (clean tree)";; *) echo "HEAD is ${head:0:7}, expected $EXPECT_COMMIT: refusing."; exit 1;; esac; else note "commit ${head:0:7} (set EXPECT_COMMIT to enforce)"; fi
    # Production fingerprint before: container ids + start times must be identical afterwards.
    prod_before="$(docker ps -a --filter 'name=^yonixtools-(web|downloader)-1$' --format '{{.Names}}' | sort | xargs -r docker inspect -f '{{.Name}} {{.Id}} {{.State.StartedAt}} {{.RestartCount}}')"
    [ -f "$ST/urls" ] || { echo "Run 'tunnels' first."; exit 1; }
    # Read the two URLs as data (never execute the state file) and re-validate them.
    SITE="$(sed -n 's/^SITE=//p' "$ST/urls")"; ADS="$(sed -n 's/^ADS=//p' "$ST/urls")"
    for u in "$SITE" "$ADS"; do printf '%s' "$u" | grep -Eq '^https://[a-z0-9-]+\.trycloudflare\.com$' || { echo "bad tunnel URL in $ST/urls: '$u'"; exit 1; }; done
    if [ ! -f "$ST/auth" ]; then
      pw="$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 24)"
      ( umask 077; printf 'staging:%s\n' "$pw" > "$ST/auth" )
      printf 'staging:%s\n' "$(openssl passwd -apr1 "$pw")" > "$ST/htpasswd"; chmod 644 "$ST/htpasswd"   # hash only; nginx worker must read it
    fi
    mkdir -p "$ST/admin"; chmod 755 "$ST/admin"; cp "$ST/htpasswd" "$ST/admin/htpasswd"   # staging admin login = staging login
    docker network inspect "$NET_PUB" >/dev/null 2>&1 || docker network create --subnet "$SUB_PUB" "$NET_PUB" >/dev/null
    docker network inspect "$NET_INT" >/dev/null 2>&1 || docker network create --internal --subnet "$SUB_INT" "$NET_INT" >/dev/null
    docker build -t yonixtools-web:staging --build-context deploy=deploy/nginx \
      --build-arg NEXT_PUBLIC_SITE_URL="https://yonixtools.com" --build-arg NEXT_PUBLIC_DOWNLOADER_API_URL=/api \
      --build-arg NEXT_PUBLIC_ADS=on \
      --build-arg NEXT_PUBLIC_AD_ORIGIN="$ADS" --build-arg AD_FRAME_PARENT="$SITE" \
      --build-arg NEXT_PUBLIC_MONETAG="${MONETAG:-off}" apps/web
    docker rm -f "$P-downloader" "$P-web" "$P-proxy" >/dev/null 2>&1 || true
    start_backend
    docker run -d --name "$P-web" --network "$NET_PUB" --restart no --read-only \
      --tmpfs /var/cache/nginx:size=64m --tmpfs /var/run:size=1m --tmpfs /tmp:size=16m \
      -v "$PWD/$ST/admin:/etc/nginx/admin:ro" \
      --security-opt no-new-privileges:true --memory 128m --cpus 0.5 yonixtools-web:staging >/dev/null
    docker network connect "$NET_INT" "$P-web"
    docker run -d --name "$P-proxy" --network "$NET_PUB" --restart no --read-only \
      -p "127.0.0.1:$SITE_PORT:$SITE_PORT" -p "127.0.0.1:$ADS_PORT:$ADS_PORT" \
      --tmpfs /var/cache/nginx:size=16m --tmpfs /var/run:size=1m --tmpfs /tmp:size=8m \
      -v "$PWD/deploy/staging/proxy.conf:/etc/nginx/conf.d/default.conf:ro" -v "$PWD/$ST/htpasswd:/etc/nginx/staging.htpasswd:ro" \
      --security-opt no-new-privileges:true --memory 64m --cpus 0.25 nginx:1.27-alpine >/dev/null
    for _ in $(seq 1 30); do curl -s -o /dev/null --noproxy '*' "http://127.0.0.1:$SITE_PORT/robots.txt" && break; sleep 1; done
    sleep 3
    echo "Gatekeeper checks"
    code() { curl -s --noproxy '*' -o /dev/null -w '%{http_code}' "$@"; }
    [ "$(code "http://127.0.0.1:$SITE_PORT/")" = 401 ] && ok "site requires the password" || bad "site reachable without password"
    [ "$(code -u "$(cat "$ST/auth")" "http://127.0.0.1:$SITE_PORT/")" = 200 ] && ok "site works with the password" || bad "site with password"
    [ "$(code "http://127.0.0.1:$SITE_PORT/admin/ads/")" = 401 ] && ok "admin test page needs the password" || bad "admin page exposed"
    [ "$(code -u "$(cat "$ST/auth")" "http://127.0.0.1:$SITE_PORT/admin/ads/")" = 200 ] && ok "admin test page works with the login" || bad "admin page with login"
    [ "$(code "http://127.0.0.1:$SITE_PORT/api/healthz")" = 401 ] && ok "API needs the password" || bad "API exposed"
    [ "$(code "http://127.0.0.1:$ADS_PORT/")" = 404 ] && ok "ad-frame origin serves nothing else" || bad "ad-frame origin exposes the site"
    [ "$(code "http://127.0.0.1:$ADS_PORT/ad-frame.html")" = 200 ] && ok "ad frame served" || bad "ad frame"
    curl -s --noproxy '*' -D - -o /dev/null "http://127.0.0.1:$SITE_PORT/" | grep -qi '^x-robots-tag: noindex' && ok "noindex header" || bad "noindex header"
    echo "Isolation checks"
    for c in "$P-web" "$P-downloader" "$P-proxy"; do
      nets="$(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' "$c")"
      case " $nets" in *" yonixtools_stack "*) bad "$c is on the production network ($nets)";; *) ok "$c networks: $nets";; esac
    done
    if [ "$BACKEND" = test ]; then
      [ "$(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' "$P-downloader")" = "$NET_INT " ] && ok "staging backend: internal network only (no internet, no production)" || bad "staging backend has extra networks"
      [ "$(docker inspect -f '{{range .Mounts}}{{.Destination}} {{end}}' "$P-downloader")" = "/stg/fake_worker.py " ] && ok "staging backend: no volumes, no production .env (only the test worker mounted)" || bad "staging backend mounts"
      title="$(curl -s --noproxy '*' -u "$(cat "$ST/auth")" -H 'Content-Type: application/json' -d '{"url":"https://www.tiktok.com/@creator/video/7350000000000000001"}' "http://127.0.0.1:$SITE_PORT/api/v1/extract" | sed -n 's/.*"title": *"\([^"]*\)".*/\1/p')"
      [ "$title" = "Test clip" ] && ok "downloader answers from the staging test backend (simulated 'Test clip')" || bad "downloader test extract returned '${title:-nothing}'"
    fi
    prod_after="$(docker ps -a --filter 'name=^yonixtools-(web|downloader)-1$' --format '{{.Names}}' | sort | xargs -r docker inspect -f '{{.Name}} {{.Id}} {{.State.StartedAt}} {{.RestartCount}}')"
    [ "$prod_before" = "$prod_after" ] && ok "production containers unchanged (same ids, start times, restarts)" || bad "production containers changed!"
    STAGING=1 SITE_HOST=yonixtools.com CURL_AUTH="$(cat "$ST/auth")" bash deploy/scripts/smoke-test.sh "http://127.0.0.1:$SITE_PORT" || true
    echo
    [ "${FAILED:-0}" = 0 ] || { echo; echo "SOME CHECKS FAILED: do not use this staging; run 'down' and send me the output."; exit 1; }
    echo "Staging ready ($(git rev-parse --short HEAD); backend $BACKEND; Monetag ${MONETAG:-off})"
    echo "  Site:      $SITE/"
    echo "  Ad test (admin): $SITE/admin/ads/"
    echo "  Login:     $(cat "$ST/auth")   (also in $PWD/$ST/auth)"
    echo "Production untouched."
    ;;
  status)
    [ -f "$ST/urls" ] && cat "$ST/urls" || echo "no tunnels"
    docker ps -a --filter "name=^$P-" --format '{{.Names}}\t{{.Status}}'
    ;;
  down)
    docker rm -f "$P-tunnel-site" "$P-tunnel-ads" "$P-proxy" "$P-web" "$P-downloader" >/dev/null 2>&1 || true
    docker network rm "$NET_PUB" "$NET_INT" >/dev/null 2>&1 || true
    docker image rm yonixtools-web:staging >/dev/null 2>&1 || true
    if iptables -n -L "$EGRESS_CHAIN" >/dev/null 2>&1; then YONIXTOOLS_SUBNET="$SUB_PUB" YONIXTOOLS_EGRESS_CHAIN="$EGRESS_CHAIN" bash deploy/scripts/egress-firewall.sh --remove >/dev/null; fi
    rm -rf "$ST"
    echo "Staging removed: tunnels, proxy, web, backend, networks, staging image, password. Production untouched."
    ;;
  *) echo "usage: $0 preflight|tunnels|up|status|down" >&2; exit 2 ;;
esac
