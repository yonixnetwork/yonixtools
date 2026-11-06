#!/usr/bin/env bash
# YoniXTools Phase 0 — read-only DigitalOcean server audit.
#
# Run ON the droplet as root:   bash do-audit.sh > do-audit.txt 2>&1
# Then review do-audit.txt (remove anything you consider sensitive) and share it.
#
# This script changes nothing: it only reads system state. It never prints
# .env files, private keys or environment variables of containers.
set -u

section() { printf '\n===== %s =====\n' "$1"; }
run() { printf '$ %s\n' "$*"; "$@" 2>&1 || printf '(exit %s)\n' "$?"; }
have() { command -v "$1" >/dev/null 2>&1; }

section "System"
run date -u
run uname -a
[ -f /etc/os-release ] && run grep -E '^(PRETTY_NAME|VERSION_ID)=' /etc/os-release
run uptime
run nproc
run free -h
run df -h -x tmpfs -x devtmpfs
run swapon --show

section "Listening ports"
run ss -tlnp

section "Docker"
if have docker; then
  run docker version --format '{{.Server.Version}}'
  run docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
  run docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}'
  run docker compose ls
  run docker volume ls
  run docker system df
else
  echo "docker not installed"
fi

section "PM2"
if have pm2; then run pm2 list; else echo "pm2 not installed"; fi

section "Systemd services (running)"
run systemctl list-units --type=service --state=running --no-pager --no-legend

section "Host Nginx"
if have nginx; then
  run nginx -v
  run ls -la /etc/nginx/sites-enabled /etc/nginx/conf.d
  # server_name / listen / proxy_pass / root lines only, not full config
  run sh -c "nginx -T 2>/dev/null | grep -nE '^# configuration file|server_name|listen|proxy_pass|root |ssl_certificate '"
else
  echo "host nginx not installed (Yonix-Alpha runs nginx inside Docker)"
fi

section "TLS certificates"
for d in /etc/letsencrypt/live /var/lib/docker/volumes/*certbot_conf*/_data/live; do
  [ -d "$d" ] && run ls -la "$d"
done
have certbot && run certbot certificates

section "Application directories"
for d in /opt /srv /var/www /home /root; do
  [ -d "$d" ] && run ls -la "$d"
done
for repo in /opt/* /srv/* /var/www/* /root/*; do
  if [ -d "$repo/.git" ]; then
    printf -- '-- git repo: %s\n' "$repo"
    run git -C "$repo" remote -v
    run git -C "$repo" log -1 --format='%h %ad %s'
    run git -C "$repo" status --short --branch
    # Presence only, never contents:
    [ -f "$repo/.env" ] && echo "   .env present (not printed)"
  fi
done

section "Scheduled jobs"
run crontab -l
run ls -la /etc/cron.d

section "Firewall"
have ufw && run ufw status verbose

section "DNS as seen from the server"
for h in yonixtools.com www.yonixtools.com yonixalpha.com www.yonixalpha.com; do
  run getent hosts "$h"
done
run curl -s -m 5 https://api.ipify.org

section "Tooling relevant to YoniXTools"
for t in node npm python3 pip3 ffmpeg yt-dlp gallery-dl git; do
  printf '%-12s ' "$t"; command -v "$t" || echo "missing"
done
echo
echo "Audit complete. Nothing was modified."
