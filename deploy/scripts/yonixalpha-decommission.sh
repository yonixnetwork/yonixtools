#!/usr/bin/env bash
# Safely retire the YonixAlpha trading stack from the droplet, in stages.
# Run as root ON THE DROPLET. Each stage refuses to run until the previous
# one has succeeded; destructive stages ask you to type a confirmation.
#
#   bash yonixalpha-decommission.sh inventory   # read-only: what exists
#   bash yonixalpha-decommission.sh check       # read-only: open positions / live orders
#   bash yonixalpha-decommission.sh backup      # full backup + restore test (stops nothing)
#   bash yonixalpha-decommission.sh stop        # stop the stack, KEEP all data (reversible)
#   bash yonixalpha-decommission.sh restart     # undo "stop"
#   bash yonixalpha-decommission.sh purge       # remove containers, volumes, images, units, cron, /opt/yonixalpha
#
# Never deletes backups. Never touches Docker itself, ufw, fail2ban, other
# compose projects (e.g. "yonixtools") or the yonixalpha.com domain.
set -uo pipefail

YA_DIR="${YA_DIR:-/opt/yonixalpha}"
BACKUP_ROOT="${BACKUP_ROOT:-/root/yonixalpha-final-backup}"
STATE_DIR="${STATE_DIR:-/root/.yonixalpha-decommission}"
PROJECT="yonixalpha"
UNIT_DIR="${UNIT_DIR:-/etc/systemd/system}"
UNITS=(yonixalpha-env-updater.path yonixalpha-env-updater.service)
ALL_PROFILES="memecoin,evm,copy,legacy"
mkdir -p "$STATE_DIR"

die() { echo "ERROR: $*" >&2; exit 1; }
info() { echo "==> $*"; }
confirm() { # confirm "<phrase>"
  local phrase="$1" reply
  echo; echo "Type exactly:  $phrase"; read -r -p "> " reply
  [ "$reply" = "$phrase" ] || die "confirmation did not match; nothing was changed"
}
compose() { (cd "$YA_DIR" && COMPOSE_PROFILES="$ALL_PROFILES" docker compose --env-file .env -f infra/docker/docker-compose.yml -f infra/docker/docker-compose.prod.yml "$@"); }
sql() { # prints the value, or "ERR" if the query failed (e.g. table missing / DB down)
  local out
  if out="$(compose exec -T postgres sh -c "psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -Atc \"$1\"" 2>/dev/null)"; then echo "${out:-0}"; else echo "ERR"; fi
}
mark() { date -u +%Y-%m-%dT%H:%M:%SZ > "$STATE_DIR/$1"; [ -n "${2:-}" ] && echo "$2" >> "$STATE_DIR/$1"; }
need() { [ -f "$STATE_DIR/$1" ] || die "run '$2' first"; }

inventory() {
  info "Compose project '$PROJECT' in $YA_DIR"
  [ -d "$YA_DIR" ] && (cd "$YA_DIR" && echo "  repo: $(git remote get-url origin 2>/dev/null) @ $(git rev-parse --short HEAD 2>/dev/null)") || echo "  $YA_DIR not found"
  docker ps -a --filter "label=com.docker.compose.project=$PROJECT" --format '  {{.Names}}  {{.Status}}  {{.Ports}}'
  info "Volumes";  docker volume ls --filter "label=com.docker.compose.project=$PROJECT" --format '  {{.Name}}'
  info "Images";   docker images --format '  {{.Repository}}:{{.Tag}}  {{.Size}}' | grep -E "^  $PROJECT" || echo "  (none built locally)"
  info "Networks"; docker network ls --filter "label=com.docker.compose.project=$PROJECT" --format '  {{.Name}}'
  info "Outside Docker"
  for u in "${UNITS[@]}"; do [ -f "$UNIT_DIR/$u" ] && echo "  systemd: $u ($(systemctl is-enabled "$u" 2>/dev/null || echo unknown))"; done
  crontab -l 2>/dev/null | grep -n "yonixalpha" | sed 's/^/  cron: /' || true
  for p in /opt/yonixalpha-backups /var/log/yonixalpha-backup.log "$YA_DIR/runtime"; do [ -e "$p" ] && echo "  path: $p ($(du -sh "$p" 2>/dev/null | cut -f1))"; done
  info "Ports 80/443"; ss -ltnp 2>/dev/null | grep -E ':(80|443) ' || echo "  free"
}

check() {
  info "Checking for open positions and live orders (read-only)"
  local live_pos live_ord paper_pos demo_pos exec_act conns blocked=0
  live_pos="$(sql "select count(*) from paper_positions where execution_mode='LIVE' and status in ('open','pending_entry','needs_review')")"
  live_ord="$(sql "select count(*) from execution_orders where mode='LIVE' and status='PENDING'")"
  paper_pos="$(sql "select count(*) from paper_positions where execution_mode='PAPER' and status in ('open','pending_entry','needs_review')")"
  demo_pos="$(sql "select count(*) from crypto.demo_positions where status='OPEN'")"
  exec_act="$(sql "select count(*) from crypto.exec_trades where status in ('PENDING_ENTRY','OPEN','CLOSING','UNCERTAIN')")"
  conns="$(sql "select string_agg(exchange||'/'||environment, ', ') from crypto.api_connections")"
  echo "  Memecoin LIVE positions:        $live_pos"
  echo "  Memecoin LIVE pending orders:   $live_ord"
  echo "  Memecoin PAPER positions:       $paper_pos (simulated; will be frozen)"
  echo "  Crypto demo positions:          $demo_pos (simulated)"
  echo "  Crypto exchange-account trades: $exec_act"
  echo "  Exchange API connections:       ${conns:-none}"
  for v in "$live_pos" "$live_ord" "$exec_act"; do
    if [ "$v" = "ERR" ]; then echo "  ! a check could not run (database down or table missing)"; blocked=1;
    elif [ "$v" != "0" ]; then blocked=1; fi
  done
  if [ "$blocked" = 1 ]; then
    echo; echo "BLOCKED: close every LIVE position/order and exchange trade in the YonixAlpha dashboard,"
    echo "switch all engines OFF, then run 'check' again. Nothing was changed."
    exit 2
  fi
  mark checked; info "No live exposure. Next: backup"
}

backup() {
  need checked check
  local ts dir
  ts="$(date -u +%Y%m%dT%H%M%SZ)"; dir="$BACKUP_ROOT/$ts"
  mkdir -p "$dir" && chmod 700 "$BACKUP_ROOT" "$dir"
  info "Backing up to $dir (the stack keeps running)"
  compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner' | gzip > "$dir/postgres.sql.gz" || die "pg_dump failed"
  gzip -t "$dir/postgres.sql.gz" || die "database dump is corrupt"
  cp -a "$YA_DIR/.env" "$dir/env.production" && chmod 600 "$dir/env.production"
  [ -d "$YA_DIR/runtime" ] && tar -C "$YA_DIR" -czf "$dir/runtime.tar.gz" runtime
  for v in certbot_conf redis_data; do
    docker volume inspect "${PROJECT}_$v" >/dev/null 2>&1 && docker run --rm -v "${PROJECT}_$v:/v:ro" -v "$dir:/out" alpine:3.20 tar -C /v -czf "/out/volume-$v.tar.gz" .
  done
  for u in "${UNITS[@]}"; do [ -f "$UNIT_DIR/$u" ] && cp -a "$UNIT_DIR/$u" "$dir/"; done
  crontab -l > "$dir/crontab.txt" 2>/dev/null || true
  (cd "$YA_DIR" && git rev-parse HEAD > "$dir/git-commit.txt" && git status --short > "$dir/git-status.txt") 2>/dev/null
  compose config > "$dir/compose-resolved.yml" 2>/dev/null && chmod 600 "$dir/compose-resolved.yml"

  info "Restore test: loading the dump into a throwaway Postgres container"
  local cid tables=0 source_tables ready=0
  source_tables="$(sql "select count(*) from information_schema.tables where table_schema not in ('pg_catalog','information_schema')")"
  cid="$(docker run -d --rm -e POSTGRES_PASSWORD=restoretest postgres:16-alpine)" || die "could not start restore-test container"
  # Check readiness over TCP: during first start the image runs a temporary,
  # socket-only server and then restarts it; a socket check can pass too early.
  for _ in $(seq 1 90); do
    if docker exec "$cid" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then ready=1; break; fi
    sleep 1
  done
  if [ "$ready" = 1 ]; then
    gunzip -c "$dir/postgres.sql.gz" | docker exec -i "$cid" psql -h 127.0.0.1 -q -U postgres -v ON_ERROR_STOP=0 >/dev/null 2>"$dir/restore-test.log"
    tables="$(docker exec "$cid" psql -h 127.0.0.1 -U postgres -Atc "select count(*) from information_schema.tables where table_schema not in ('pg_catalog','information_schema')" 2>>"$dir/restore-test.log")"
  else
    echo "restore-test container never became ready" >> "$dir/restore-test.log"
    docker logs "$cid" >> "$dir/restore-test.log" 2>&1
  fi
  docker stop "$cid" >/dev/null 2>&1
  echo "  tables: live database ${source_tables}, restored copy ${tables:-0}"
  if [ "${tables:-0}" -le 0 ] 2>/dev/null || { [ "$source_tables" != "ERR" ] && [ "${tables:-0}" -lt "$source_tables" ]; }; then
    echo "--- last lines of $dir/restore-test.log:"; tail -n 25 "$dir/restore-test.log"
    die "restore test failed; backup NOT marked as verified"
  fi
  local errs; errs="$(grep -c "ERROR" "$dir/restore-test.log" 2>/dev/null || true)"
  [ "${errs:-0}" -gt 0 ] && echo "  note: $errs non-fatal restore message(s) (e.g. roles/extensions missing in the test container), see restore-test.log"
  (cd "$dir" && sha256sum ./* > SHA256SUMS)
  echo "  restore test OK"; ls -la "$dir"
  mark backed-up "$dir"
  echo; echo "IMPORTANT: copy $dir OFF the server now (it contains secrets), e.g.:"
  echo "  scp -r root@<droplet>:$dir ./yonixalpha-backup-$ts"
  echo "Then run 'stop'."
}

stop() {
  need checked check; need backed-up backup
  info "Re-checking positions right before stopping"
  check || exit 2
  echo "This stops every YonixAlpha container (dashboard, trading workers, its Nginx on 80/443)."
  echo "Data volumes, images, $YA_DIR and backups are KEPT. Undo with: $0 restart"
  confirm "stop yonixalpha"
  for u in "${UNITS[@]}"; do systemctl disable --now "$u" 2>/dev/null || true; done
  compose down --remove-orphans || die "compose down failed"
  if crontab -l 2>/dev/null | grep -q "yonixalpha/scripts/backup-db.sh"; then
    local tab; tab="$(crontab -l | sed 's|^\([^#].*yonixalpha/scripts/backup-db.sh.*\)$|# disabled by decommission: \1|')"
    printf '%s\n' "$tab" | crontab -
    echo "  cron backup entry commented out"
  fi
  mark stopped
  info "Stopped. Ports 80/443: $(ss -ltn 2>/dev/null | grep -cE ':(80|443) ') listener(s) remaining"
  echo "Next: set up the YoniXTools edge (deploy/scripts/setup-edge-host.sh). Run 'purge' only after YoniXTools has been stable for a while."
}

restart() {
  need stopped stop
  for u in "${UNITS[@]}"; do [ -f "$UNIT_DIR/$u" ] && systemctl enable --now "$u" 2>/dev/null; done
  if crontab -l 2>/dev/null | grep -q "^# disabled by decommission: "; then
    local tab; tab="$(crontab -l | sed 's|^# disabled by decommission: ||')"
    printf '%s\n' "$tab" | crontab -
  fi
  (cd "$YA_DIR" && bash scripts/deploy.sh) || die "redeploy failed"
  rm -f "$STATE_DIR/stopped"; info "YonixAlpha restarted"
}

purge() {
  need stopped stop
  local backup_dir; backup_dir="$(sed -n 2p "$STATE_DIR/backed-up")"
  [ -f "$backup_dir/SHA256SUMS" ] || die "verified backup not found at $backup_dir"
  (cd "$backup_dir" && sha256sum -c --quiet SHA256SUMS) || die "backup checksum mismatch; not purging"
  echo "PERMANENTLY removes: YonixAlpha containers, volumes (database!), images, network,"
  echo "systemd units, cron entry, $YA_DIR, /opt/yonixalpha-backups and its log."
  echo "Kept: $backup_dir (verified). Make sure you have an off-server copy."
  confirm "permanently delete yonixalpha"
  compose down --volumes --rmi local --remove-orphans 2>/dev/null || true
  docker volume ls -q --filter "label=com.docker.compose.project=$PROJECT" | xargs -r docker volume rm
  docker images --format '{{.Repository}}:{{.Tag}}' | grep -E "^$PROJECT" | xargs -r docker rmi
  docker network ls -q --filter "label=com.docker.compose.project=$PROJECT" | xargs -r docker network rm
  for u in "${UNITS[@]}"; do systemctl disable --now "$u" 2>/dev/null || true; rm -f "$UNIT_DIR/$u"; done
  systemctl daemon-reload 2>/dev/null || true
  local tab; tab="$(crontab -l 2>/dev/null | grep -v "yonixalpha/scripts/backup-db.sh" || true)"
  printf '%s\n' "$tab" | crontab - 2>/dev/null || true
  rm -rf "$YA_DIR" /opt/yonixalpha-backups /var/log/yonixalpha-backup.log
  docker builder prune -f >/dev/null 2>&1 || true
  mark purged
  info "YonixAlpha removed. Remaining manual steps: revoke its secrets (see docs/MIGRATION_FROM_YONIXALPHA.md)."
}

case "${1:-}" in
  inventory) inventory ;;
  check) check ;;
  backup) backup ;;
  stop) stop ;;
  restart) restart ;;
  purge) purge ;;
  *) sed -n 2,14p "$0"; exit 1 ;;
esac
