#!/usr/bin/env bash
# Check, from THIS server's IP, which platforms the downloader can really
# download from. Runs the service's own worker inside the running container
# (same code, dependencies, sandbox and firewall that users get). Read-only:
# it only writes small temporary files inside the container.
#
#   bash deploy/scripts/diagnose-platforms.sh                 # every platform, built-in public samples
#   bash deploy/scripts/diagnose-platforms.sh youtube         # one platform
#   bash deploy/scripts/diagnose-platforms.sh facebook 'https://www.facebook.com/share/r/…'   # your own links
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
dc() { docker compose -p yonixtools -f "$HERE/docker-compose.yml" "$@"; }
dc ps --status running downloader | grep -q downloader || { echo "ERROR: the downloader container is not running (run deploy/scripts/deploy.sh)." >&2; exit 1; }

ALL="instagram tiktok youtube facebook x pinterest reddit vimeo dailymotion twitch soundcloud bluesky streamable"
platforms="${1:-$ALL}"
shift || true
url_args=()
for u in "$@"; do url_args+=(--url "$u"); done

for p in $platforms; do
  dc exec -T -e TMPDIR=/var/lib/yonixtools/tmp downloader \
    python diagnostics/live_matrix.py --platform "$p" --worker-only --out "/var/lib/yonixtools/tmp/diag-$p.json" "${url_args[@]}" \
    | sed -e 's/^\[OK \]/[DOWNLOAD OK]/' -e 's/^\[META\]/[INFO ONLY  ]/' -e 's/^\[FAIL\]/[FAILED     ]/'
  dc exec -T downloader rm -f "/var/lib/yonixtools/tmp/diag-$p.json" || true
done
echo
echo "DOWNLOAD OK = info and a real file download worked from this server."
echo "FAILED lines show the platform's own error (e.g. 'Sign in to confirm you're not a bot' = this server's IP is blocked)."
