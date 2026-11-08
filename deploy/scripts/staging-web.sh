#!/usr/bin/env bash
# Staging copy of the web front end, ON THE SERVER, next to production and without
# touching it. Production containers, images, edge proxy, firewall and DNS are not
# changed, and no port is opened: the container listens on 127.0.0.1 only and is
# published through outbound Cloudflare "quick tunnels" (random *.trycloudflare.com
# hostnames, no account).
#
#   bash deploy/scripts/staging-web.sh tunnels         # 1. two tunnels: site + separate ad-frame origin
#   MONETAG=on bash deploy/scripts/staging-web.sh up   # 2. build this checkout and run it
#   bash deploy/scripts/staging-web.sh status          # show the staging URLs
#   bash deploy/scripts/staging-web.sh down            # remove everything staging created
#
# The two tunnels give the site and the ad frame different origins (different sites,
# like a dedicated ad domain), so the Adsterra frame is tested isolated. Both point at
# the same staging container. It joins the production stack's private network only so
# /api/ reaches the existing downloader.
set -euo pipefail
cd "$(dirname "$0")/../.."
NAME=yonixtools-web-staging
PORT="${STAGING_PORT:-8091}"
URLS=".staging-urls"   # written by "tunnels", read by "up" (git-ignored)

tunnel_url() { docker logs "$1" 2>&1 | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | head -1; }
start_tunnel() {
  docker rm -f "$1" >/dev/null 2>&1 || true
  docker run -d --name "$1" --network host cloudflare/cloudflared:latest tunnel --no-autoupdate --url "http://127.0.0.1:$PORT" >/dev/null
  for _ in $(seq 1 45); do u="$(tunnel_url "$1")"; [ -n "$u" ] && { echo "$u"; return; }; sleep 1; done
  echo "no URL from $1; see: docker logs $1" >&2; exit 1
}

case "${1:-}" in
  tunnels)
    site="$(start_tunnel "$NAME-tunnel-site")"
    ads="$(start_tunnel "$NAME-tunnel-ads")"
    printf 'SITE=%s\nADS=%s\n' "$site" "$ads" > "$URLS"
    echo "Site:     $site"
    echo "Ad frame: $ads"
    echo "Next: MONETAG=on bash deploy/scripts/staging-web.sh up"
    ;;
  up)
    [ -f "$URLS" ] || { echo "Run 'tunnels' first."; exit 1; }
    # shellcheck disable=SC1090
    . "./$URLS"
    docker build -t yonixtools-web:staging --build-context deploy=deploy/nginx \
      --build-arg NEXT_PUBLIC_SITE_URL="https://yonixtools.com" \
      --build-arg NEXT_PUBLIC_DOWNLOADER_API_URL=/api \
      --build-arg NEXT_PUBLIC_ADS=on \
      --build-arg NEXT_PUBLIC_AD_ISOLATION=same-origin \
      --build-arg NEXT_PUBLIC_AD_ORIGIN="$ADS" \
      --build-arg AD_FRAME_PARENT="$SITE" \
      --build-arg NEXT_PUBLIC_MONETAG="${MONETAG:-off}" \
      apps/web
    docker rm -f "$NAME" >/dev/null 2>&1 || true
    docker run -d --name "$NAME" --network yonixtools_stack -p "127.0.0.1:$PORT:80" \
      --read-only --tmpfs /var/cache/nginx:size=64m --tmpfs /var/run:size=1m --tmpfs /tmp:size=16m \
      --security-opt no-new-privileges:true --memory 128m --cpus 0.5 yonixtools-web:staging >/dev/null
    sleep 2
    STAGING=1 SITE_HOST=yonixtools.com bash deploy/scripts/smoke-test.sh "http://127.0.0.1:$PORT" || true
    echo
    echo "Staging ($(git rev-parse --short HEAD), Monetag ${MONETAG:-off}):"
    echo "  Site:      $SITE/"
    echo "  Ads check: $SITE/ads-check/"
    echo "Production untouched."
    ;;
  status)
    if [ -f "$URLS" ]; then cat "$URLS"; else echo "no tunnels"; fi
    docker ps --filter "name=$NAME" --format '{{.Names}}  {{.Status}}'
    ;;
  down)
    docker rm -f "$NAME-tunnel-site" "$NAME-tunnel-ads" "$NAME" >/dev/null 2>&1 || true
    docker image rm yonixtools-web:staging >/dev/null 2>&1 || true
    rm -f "$URLS"
    echo "Staging removed."
    ;;
  *) echo "usage: $0 tunnels|up|status|down" >&2; exit 2 ;;
esac
