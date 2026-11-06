#!/usr/bin/env bash
# READ-ONLY checks to run on the server BEFORE the first YoniXTools deploy.
# Changes nothing. Exits non-zero if something would conflict.
#   bash deploy/scripts/preflight.sh
set -uo pipefail
WEB_PORT="${WEB_PORT:-8090}"
problems=0
say() { printf '%-8s %s\n' "$1" "$2"; }
warn() { say "WARN" "$1"; }
fail() { say "BLOCK" "$1"; problems=$((problems+1)); }
okay() { say "OK" "$1"; }

command -v docker >/dev/null && okay "docker $(docker version --format '{{.Server.Version}}' 2>/dev/null)" || fail "docker is not installed"
docker compose version >/dev/null 2>&1 && okay "docker compose plugin" || fail "docker compose plugin missing"

if ss -ltn "( sport = :$WEB_PORT )" 2>/dev/null | grep -q LISTEN; then fail "port $WEB_PORT is already in use (set WEB_PORT to a free port)"; else okay "port 127.0.0.1:$WEB_PORT is free"; fi
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^yonixtools-'; then warn "yonixtools containers already running (this will be an update)"; fi

mem_mb=$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo)
total_mb=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
[ "$mem_mb" -ge 1300 ] && okay "available memory ${mem_mb} MB of ${total_mb} MB" || warn "only ${mem_mb} MB RAM available of ${total_mb} MB: YoniXTools needs ~1.2 GB at peak (2 concurrent downloads). Stop other workloads or resize."
disk_mb=$(df -Pm /var/lib/docker 2>/dev/null | awk 'NR==2 {print $4}')
[ "${disk_mb:-0}" -ge 8000 ] && okay "free disk ${disk_mb} MB" || warn "free disk ${disk_mb:-?} MB: images need ~2 GB and temp downloads up to MAX_TEMP_USAGE_MB (default 4 GB)"
swap=$(awk '/SwapTotal/ {print int($2/1024)}' /proc/meminfo); [ "$swap" -gt 0 ] && okay "swap ${swap} MB" || warn "no swap configured: consider 2 GB of swap on a 2 GB droplet"

echo; echo "Who owns ports 80/443 (the edge proxy):"
ss -ltnp 2>/dev/null | grep -E ':(80|443) ' || echo "  nothing listening on 80/443"
docker ps --format '  {{.Names}}  {{.Ports}}' 2>/dev/null | grep -E '0\.0\.0\.0:(80|443)->' || true
[ -f services/downloader/.env ] && okay "services/downloader/.env exists" || fail "services/downloader/.env missing (copy .env.example)"
[ -f services/downloader/.env ] && grep -q '^APP_ENV=production' services/downloader/.env && okay "APP_ENV=production" || warn "APP_ENV is not production in services/downloader/.env"

echo; [ "$problems" -eq 0 ] && echo "Preflight passed (warnings above, if any, need a decision)." || echo "Preflight found $problems blocking problem(s)."
exit "$problems"
