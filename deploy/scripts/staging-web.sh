#!/usr/bin/env bash
# Staging copy of the web front end, ON THE SERVER, next to production and
# without touching it: builds the checked-out commit as yonixtools-web:staging
# and runs it on 127.0.0.1:8091 (not public). It joins the production stack's
# private network only so /api/ reaches the existing downloader. Production
# containers, images, Nginx edge config and DNS are not changed.
#   bash deploy/scripts/staging-web.sh up     # build and start
#   bash deploy/scripts/staging-web.sh tunnel # temporary public https URL (for phones)
#   bash deploy/scripts/staging-web.sh down   # stop and remove (tunnel included)
# The tunnel is a Cloudflare "quick tunnel" (random *.trycloudflare.com URL, no
# account, no DNS or firewall change); it exposes only the staging container.
# Or view it from your computer through SSH:
#   ssh -L 8091:127.0.0.1:8091 root@<droplet>   then open http://localhost:8091/
set -euo pipefail
cd "$(dirname "$0")/../.."
NAME=yonixtools-web-staging
PORT="${STAGING_PORT:-8091}"
case "${1:-up}" in
  up)
    docker build -t yonixtools-web:staging --build-context deploy=deploy/nginx \
      --build-arg NEXT_PUBLIC_SITE_URL="${SITE_URL:-https://yonixtools.com}" \
      --build-arg NEXT_PUBLIC_DOWNLOADER_API_URL=/api \
      --build-arg NEXT_PUBLIC_ADS="${ADS:-on}" \
      --build-arg NEXT_PUBLIC_AD_ISOLATION="${AD_ISOLATION:-same-origin}" \
      apps/web
    docker rm -f "$NAME" >/dev/null 2>&1 || true
    docker run -d --name "$NAME" --network yonixtools_stack -p "127.0.0.1:$PORT:80" \
      --read-only --tmpfs /var/cache/nginx:size=64m --tmpfs /var/run:size=1m --tmpfs /tmp:size=16m \
      --security-opt no-new-privileges:true --memory 128m --cpus 0.5 yonixtools-web:staging >/dev/null
    sleep 2
    SITE_HOST="${SITE_HOST:-yonixtools.com}" bash deploy/scripts/smoke-test.sh "http://127.0.0.1:$PORT"
    echo "Staging running on 127.0.0.1:$PORT ($(git rev-parse --short HEAD)). Production untouched."
    ;;
  tunnel)
    docker rm -f "$NAME-tunnel" >/dev/null 2>&1 || true
    docker run -d --name "$NAME-tunnel" --network host cloudflare/cloudflared:latest tunnel --no-autoupdate --url "http://127.0.0.1:$PORT" >/dev/null
    for _ in $(seq 1 30); do
      url="$(docker logs "$NAME-tunnel" 2>&1 | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | head -1)"
      [ -n "$url" ] && break
      sleep 1
    done
    [ -n "${url:-}" ] && echo "Staging URL: $url   (ads check: $url/ads-check/)" || { echo "No tunnel URL yet; see: docker logs $NAME-tunnel"; exit 1; }
    ;;
  down)
    docker rm -f "$NAME-tunnel" >/dev/null 2>&1 || true
    docker rm -f "$NAME" >/dev/null 2>&1 || true
    docker image rm yonixtools-web:staging >/dev/null 2>&1 || true
    echo "Staging removed."
    ;;
  *) echo "usage: $0 up|tunnel|down" >&2; exit 2 ;;
esac
