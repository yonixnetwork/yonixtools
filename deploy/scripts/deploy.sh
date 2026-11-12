#!/usr/bin/env bash
# Deploy or update the YoniXTools stack ON THE SERVER, from the repository root.
# Touches only the "yonixtools" compose project. Never stops other containers.
#   bash deploy/scripts/deploy.sh            # deploy the checked-out commit
#   DEPLOY_PULL=1 bash deploy/scripts/deploy.sh   # git pull --ff-only first
set -euo pipefail
cd "$(dirname "$0")/../.."
COMPOSE=(docker compose -f deploy/docker-compose.yml)

# Production hostnames (owner, 12 Nov 2026): the site is https://yonixtools.com and advertising lives
# only on https://ads.yonixtools.com. Refuse anything else, so a typo can't swap in another domain.
[ "${SITE_URL:-https://yonixtools.com}" = "https://yonixtools.com" ] || { echo "SITE_URL must be https://yonixtools.com (got '${SITE_URL}')."; exit 1; }
case "${AD_ORIGIN:-}" in
  ""|https://ads.yonixtools.com) ;;
  *) echo "AD_ORIGIN must be https://ads.yonixtools.com or empty (no ads), got '${AD_ORIGIN}'."; exit 1 ;;
esac
if [ -n "${AD_FRAME_PARENT:-}" ] && [ "$AD_FRAME_PARENT" != "https://yonixtools.com" ]; then echo "AD_FRAME_PARENT must be https://yonixtools.com."; exit 1; fi

bash deploy/scripts/preflight.sh || { echo "Fix preflight problems first."; exit 1; }
if [ "${DEPLOY_PULL:-0}" = "1" ]; then git fetch origin && git merge --ff-only "origin/$(git rev-parse --abbrev-ref HEAD)"; fi
rev="$(git rev-parse --short HEAD)"
# Rollback readiness: keep the images that are running now as :previous (a tagged image survives
# "docker image prune"), together with the commit they came from. deploy/scripts/rollback.sh
# switches back to them in seconds, without rebuilding.
mkdir -p deploy/state
for img in yonixtools-web yonixtools-downloader; do
  if docker image inspect "$img:latest" >/dev/null 2>&1; then docker tag "$img:latest" "$img:previous"; fi
done
[ -f deploy/state/deployed-rev ] && cp deploy/state/deployed-rev deploy/state/previous-rev
echo "==> Kept the current images as :previous for rollback ($(cat deploy/state/previous-rev 2>/dev/null || echo 'commit unknown'))"
echo "==> Building images for $rev (one at a time, to spare a small server)"
"${COMPOSE[@]}" build downloader
"${COMPOSE[@]}" build web
echo "==> Starting"
mkdir -p deploy/admin-auth   # admin password hash (deploy/scripts/admin-password.sh); empty = /admin/ locked
"${COMPOSE[@]}" up -d --remove-orphans
echo "==> Egress firewall (blocks the stack from reaching private/internal addresses)"
bash deploy/scripts/egress-firewall.sh
if [ -d /etc/systemd/system ] && [ ! -f /etc/systemd/system/yonixtools-egress.service ]; then
  cat > /etc/systemd/system/yonixtools-egress.service <<UNIT
[Unit]
Description=YoniXTools egress firewall (SSRF defence)
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
ExecStart=/usr/bin/env bash $(pwd)/deploy/scripts/egress-firewall.sh
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
UNIT
  systemctl daemon-reload && systemctl enable yonixtools-egress.service >/dev/null && echo "    re-applied at boot by yonixtools-egress.service"
fi
echo "==> Waiting for health checks"
for _ in $(seq 1 60); do
  web="$(docker inspect -f '{{.State.Health.Status}}' yonixtools-web-1 2>/dev/null || echo starting)"
  dl="$(docker inspect -f '{{.State.Health.Status}}' yonixtools-downloader-1 2>/dev/null || echo starting)"
  [ "$web" = healthy ] && [ "$dl" = healthy ] && break
  sleep 2
done
[ "$web" = healthy ] && [ "$dl" = healthy ] || { echo "Not healthy (web=$web downloader=$dl). Logs:"; "${COMPOSE[@]}" logs --tail 50; exit 1; }
echo "==> Local smoke test (through the stack's own Nginx on 127.0.0.1:${WEB_PORT:-8090})"
AD_HOST="${AD_ORIGIN:+${AD_ORIGIN#*://}}" SITE_HOST="${SITE_HOST:-yonixtools.com}" bash deploy/scripts/smoke-test.sh "http://127.0.0.1:${WEB_PORT:-8090}" || { echo "Smoke test failed. Roll back with: bash deploy/scripts/rollback.sh"; exit 1; }
echo "$rev" > deploy/state/deployed-rev
docker image prune -f >/dev/null   # dangling images only; :latest and :previous are kept
echo "==> Deploy complete: $rev"
