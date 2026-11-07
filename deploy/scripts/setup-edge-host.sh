#!/usr/bin/env bash
# Install the host-level edge proxy (Nginx + Let's Encrypt) for YoniXTools.
# Run as root on the droplet AFTER:
#   - the YoniXTools stack is running (deploy/scripts/deploy.sh → 127.0.0.1:8090), and
#   - nothing else listens on ports 80/443 (e.g. YonixAlpha stopped), and
#   - DNS for the domain (and www) points at this server.
#
#   DOMAIN=yonixtools.com EMAIL=you@example.com bash deploy/scripts/setup-edge-host.sh
set -euo pipefail
DOMAIN="${DOMAIN:-yonixtools.com}"
EMAIL="${EMAIL:?set EMAIL to an address for certificate expiry notices}"
UPSTREAM_PORT="${WEB_PORT:-8090}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
SITE=/etc/nginx/sites-available/yonixtools
WEBROOT=/var/www/certbot

die() { echo "ERROR: $*" >&2; exit 1; }
[ "$(id -u)" = 0 ] || die "run as root"

echo "==> Preflight"
curl -fsS --max-time 5 "http://127.0.0.1:${UPSTREAM_PORT}/healthz" >/dev/null || die "YoniXTools is not answering on 127.0.0.1:${UPSTREAM_PORT}. Run deploy/scripts/deploy.sh first."
if ss -ltnp 2>/dev/null | grep -E ':(80|443) ' | grep -vq nginx; then
  ss -ltnp | grep -E ':(80|443) '
  die "ports 80/443 are used by something other than host Nginx (YonixAlpha still running?)."
fi
server_ip="$(curl -fsS --max-time 5 https://api.ipify.org || true)"
for host in "$DOMAIN" "www.$DOMAIN"; do
  ips="$(getent ahostsv4 "$host" | awk '{print $1}' | sort -u | tr '\n' ' ')"
  echo "  $host -> ${ips:-unresolved} (this server: ${server_ip:-unknown})"
  if [ -n "$server_ip" ] && ! grep -qw "$server_ip" <<<"$ips"; then
    die "$host does not point at this server yet. Switch DNS first: certificate issuance needs it."
  fi
done

echo "==> Installing Nginx and certbot"
apt-get update -qq
apt-get install -y -qq nginx certbot >/dev/null
mkdir -p "$WEBROOT"

echo "==> Stage 1: HTTP-only site (needed to obtain the first certificate)"
cat > "$SITE" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} www.${DOMAIN};
    location /.well-known/acme-challenge/ { root ${WEBROOT}; }
    location / { proxy_pass http://127.0.0.1:${UPSTREAM_PORT}; proxy_set_header Host \$host; proxy_set_header X-Real-IP \$remote_addr; }
}
EOF
ln -sf "$SITE" /etc/nginx/sites-enabled/yonixtools
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl enable --now nginx && systemctl reload nginx

echo "==> Obtaining certificate for ${DOMAIN} and www.${DOMAIN}"
certbot certonly --webroot -w "$WEBROOT" -d "$DOMAIN" -d "www.$DOMAIN" --email "$EMAIL" --agree-tos --non-interactive \
  --deploy-hook "systemctl reload nginx"

echo "==> Stage 2: full HTTPS site"
sed -e "s#yonixtools\.com#${DOMAIN}#g" -e "s#127\.0\.0\.1:8090#127.0.0.1:${UPSTREAM_PORT}#" -e "s#root /var/www/certbot;#root ${WEBROOT};#" \
  "$HERE/nginx/edge-host.conf" > "$SITE"
nginx -t && systemctl reload nginx

echo "==> Verifying"
curl -fsS --max-time 10 --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/healthz" >/dev/null && echo "  https://${DOMAIN}/healthz OK"
systemctl list-timers certbot.timer --no-pager 2>/dev/null | grep -q certbot && echo "  automatic renewal: certbot.timer active"
echo "Done. Run: SITE_HOST=${DOMAIN} bash deploy/scripts/smoke-test.sh https://${DOMAIN}"
