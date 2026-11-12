#!/usr/bin/env bash
# Roll the YoniXTools stack back to the images that were running before the last deploy
# (tagged :previous by deploy.sh). No rebuild, no git change, no volume or data change:
# only the "yonixtools" compose project's two containers are recreated.
#   bash deploy/scripts/rollback.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
COMPOSE=(docker compose -f deploy/docker-compose.yml)
for img in yonixtools-web yonixtools-downloader; do
  docker image inspect "$img:previous" >/dev/null 2>&1 || { echo "No $img:previous image: nothing to roll back to."; exit 1; }
done
echo "==> Rolling back to the previous images ($(cat deploy/state/previous-rev 2>/dev/null || echo 'commit unknown'))"
for img in yonixtools-web yonixtools-downloader; do
  docker image inspect "$img:latest" >/dev/null 2>&1 && docker tag "$img:latest" "$img:failed"   # keep the new ones for inspection
  docker tag "$img:previous" "$img:latest"
done
"${COMPOSE[@]}" up -d --no-build --remove-orphans
for _ in $(seq 1 60); do
  web="$(docker inspect -f '{{.State.Health.Status}}' yonixtools-web-1 2>/dev/null || echo starting)"
  dl="$(docker inspect -f '{{.State.Health.Status}}' yonixtools-downloader-1 2>/dev/null || echo starting)"
  [ "$web" = healthy ] && [ "$dl" = healthy ] && break
  sleep 2
done
echo "web=$web downloader=$dl"
[ "$web" = healthy ] && [ "$dl" = healthy ] || { "${COMPOSE[@]}" logs --tail 50; exit 1; }
[ -f deploy/state/previous-rev ] && cp deploy/state/previous-rev deploy/state/deployed-rev
echo "==> Rolled back. The new images are kept as :failed (remove later: docker rmi yonixtools-web:failed yonixtools-downloader:failed)."
echo "    Note: the previous images were built for their own AD_ORIGIN/MONETAG settings."
