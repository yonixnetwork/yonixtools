#!/usr/bin/env bash
# Deploy or update the YoniXTools stack ON THE SERVER, from the repository root.
# Touches only the "yonixtools" compose project. Never stops other containers.
#   bash deploy/scripts/deploy.sh            # deploy the checked-out commit
#   DEPLOY_PULL=1 bash deploy/scripts/deploy.sh   # git pull --ff-only first
set -euo pipefail
cd "$(dirname "$0")/../.."
COMPOSE=(docker compose -f deploy/docker-compose.yml)

bash deploy/scripts/preflight.sh || { echo "Fix preflight problems first."; exit 1; }
if [ "${DEPLOY_PULL:-0}" = "1" ]; then git fetch origin && git merge --ff-only "origin/$(git rev-parse --abbrev-ref HEAD)"; fi
rev="$(git rev-parse --short HEAD)"
echo "==> Building images for $rev (one at a time, to spare a small server)"
"${COMPOSE[@]}" build downloader
"${COMPOSE[@]}" build web
echo "==> Starting"
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
SITE_HOST="${SITE_HOST:-yonixtools.com}" bash deploy/scripts/smoke-test.sh "http://127.0.0.1:${WEB_PORT:-8090}" || { echo "Smoke test failed. The previous images are still available for rollback (docs/DEPLOYMENT.md)."; exit 1; }
docker image prune -f >/dev/null
echo "==> Deploy complete: $rev"
