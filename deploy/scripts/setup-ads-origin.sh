#!/usr/bin/env bash
# Set up the isolated ad origin https://ads.yonixtools.com on the host Nginx (run as root).
# Adds ONE new site file; the existing yonixtools.com site file is never edited.
#   bash deploy/scripts/setup-ads-origin.sh check    # read-only: DNS, nginx, certbot, ports
#   bash deploy/scripts/setup-ads-origin.sh http     # phase 1: HTTP-only site (for the certificate)
#   bash deploy/scripts/setup-ads-origin.sh cert     # phase 2: issue the certificate (Let's Encrypt, webroot)
#   bash deploy/scripts/setup-ads-origin.sh https    # phase 3: full site (serves /ad-frame.html only)
#   bash deploy/scripts/setup-ads-origin.sh remove   # undo: remove the ad site (certificate kept)
# Every change runs "nginx -t" first and is rolled back automatically if the test fails.
set -euo pipefail
cd "$(dirname "$0")/../.."
HOST=ads.yonixtools.com
SITE=/etc/nginx/sites-available/yonixtools-ads
LINK=/etc/nginx/sites-enabled/yonixtools-ads
WEBROOT=/var/www/certbot
BACKUP=/root/nginx-backups

need_root() { [ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }; }
install_site() { # $1 = config file to install
  need_root
  mkdir -p "$BACKUP"; ts="$(date +%Y%m%d-%H%M%S)"
  [ -f "$SITE" ] && cp -a "$SITE" "$BACKUP/yonixtools-ads.$ts"
  had_link=0; [ -L "$LINK" ] && had_link=1
  cp "$1" "$SITE"; ln -sfn "$SITE" "$LINK"
  if nginx -t 2>&1 | tail -2; then systemctl reload nginx && echo "OK: $1 installed, nginx reloaded"
  else
    echo "nginx -t FAILED: rolling back" >&2
    if [ -f "$BACKUP/yonixtools-ads.$ts" ]; then cp -a "$BACKUP/yonixtools-ads.$ts" "$SITE"; else rm -f "$SITE"; fi
    [ "$had_link" = 1 ] || rm -f "$LINK"
    nginx -t >/dev/null 2>&1 && echo "rolled back; nginx config valid again" >&2
    exit 1
  fi
}

case "${1:-}" in
  check)
    ip_site="$(dig +short yonixtools.com A | tail -1)"; ip_ads="$(dig +short "$HOST" A | tail -1)"
    echo "yonixtools.com -> ${ip_site:-?}   $HOST -> ${ip_ads:-not set}"
    [ -n "$ip_ads" ] && [ "$ip_ads" = "$ip_site" ] && echo "PASS  DNS for $HOST points to this site's server" || echo "WAIT  DNS for $HOST not set (or not propagated yet)"
    nginx -t >/dev/null 2>&1 && echo "PASS  current nginx config is valid" || echo "FAIL  current nginx config invalid (fix first)"
    command -v certbot >/dev/null && echo "PASS  certbot $(certbot --version 2>&1 | awk '{print $2}')" || echo "FAIL  certbot not installed"
    [ -d "$WEBROOT" ] && echo "PASS  webroot $WEBROOT exists" || echo "NOTE  webroot $WEBROOT missing (phase http creates it)"
    [ -f "/etc/letsencrypt/live/$HOST/fullchain.pem" ] && echo "NOTE  certificate for $HOST already exists" || echo "NOTE  no certificate for $HOST yet"
    [ -L "$LINK" ] && echo "NOTE  ad site already enabled ($SITE)" || echo "NOTE  ad site not installed yet"
    curl -s -o /dev/null -w "NOTE  local web container: %{http_code} for /ad-frame.html\n" --noproxy '*' http://127.0.0.1:8090/ad-frame.html || true
    ;;
  http)
    ip_site="$(dig +short yonixtools.com A | tail -1)"; ip_ads="$(dig +short "$HOST" A | tail -1)"
    [ -n "$ip_ads" ] && [ "$ip_ads" = "$ip_site" ] || { echo "DNS for $HOST is not pointing here yet (${ip_ads:-not set}); add the A record first." >&2; exit 1; }
    mkdir -p "$WEBROOT"
    install_site deploy/nginx/edge-ads-origin-http.conf
    ;;
  cert)
    need_root
    [ -L "$LINK" ] || { echo "run 'http' first" >&2; exit 1; }
    certbot certonly --webroot -w "$WEBROOT" -d "$HOST" --non-interactive --agree-tos --keep-until-expiring --deploy-hook "systemctl reload nginx"
    ;;
  https)
    [ -f "/etc/letsencrypt/live/$HOST/fullchain.pem" ] || { echo "no certificate for $HOST: run 'cert' first" >&2; exit 1; }
    install_site deploy/nginx/edge-ads-origin.conf
    code="$(curl -s -o /dev/null -w '%{http_code}' "https://$HOST/ad-frame.html")"; other="$(curl -s -o /dev/null -w '%{http_code}' "https://$HOST/")"
    echo "https://$HOST/ad-frame.html -> $code (expect 200)   https://$HOST/ -> $other (expect 404)"
    ;;
  remove)
    need_root
    mkdir -p "$BACKUP"; [ -f "$SITE" ] && cp -a "$SITE" "$BACKUP/yonixtools-ads.removed.$(date +%Y%m%d-%H%M%S)"
    rm -f "$LINK" "$SITE"
    nginx -t >/dev/null 2>&1 && systemctl reload nginx && echo "ad site removed, nginx reloaded (certificate kept in /etc/letsencrypt)"
    ;;
  *) echo "usage: $0 check|http|cert|https|remove" >&2; exit 2 ;;
esac
