#!/usr/bin/env bash
# READ-ONLY pre-release check for the production server. Changes nothing.
#   cd /opt/yonixtools && EXPECT_COMMIT=<hash> bash deploy/scripts/release-check.sh
# Verifies what the deploy relies on: the exact commit, disk for the build + rollback images, the
# edge configuration of yonixtools.com / ads.yonixtools.com, certificates, the admin password file,
# the downloader .env, and lists (never touches) volumes and other projects' containers.
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1
FAILED=0
ok()   { echo "  PASS  $1"; }
bad()  { echo "  FAIL  $1"; FAILED=1; }
note() { echo "  NOTE  $1"; }
SITE_EDGE=/etc/nginx/sites-enabled/yonixtools
ADS_EDGE=/etc/nginx/sites-enabled/yonixtools-ads

echo "Code"
head="$(git rev-parse --short HEAD 2>/dev/null)"
if [ -z "${EXPECT_COMMIT:-}" ]; then bad "EXPECT_COMMIT not set (the commit from Claude's report)"
elif [ "$head" = "${EXPECT_COMMIT:0:7}" ]; then ok "checked out $head"
else bad "checked out $head, expected $EXPECT_COMMIT"; fi
[ -z "$(git status --porcelain --untracked-files=no)" ] && ok "no local changes to tracked files" || bad "local changes to tracked files: $(git status --porcelain --untracked-files=no | tr '\n' ' ')"

echo "Disk (build of both images + the :previous rollback images)"
free_gb=$(df -BG --output=avail / | tail -1 | tr -dc 0-9)
[ "${free_gb:-0}" -ge 5 ] && ok "${free_gb} GB free (need >= 5 GB)" || bad "only ${free_gb} GB free (need >= 5 GB): free space first (build cache), see the release notes"
docker ps --format '{{.Names}}' | grep -q '^yonixtools-stg-' && note "staging containers are running: 'bash deploy/scripts/staging-web.sh down' in /opt/yonixtools-staging frees space" || ok "no staging containers running"

echo "Running production (not touched by this check)"
for c in yonixtools-web-1 yonixtools-downloader-1; do
  st="$(docker inspect -f '{{.State.Status}} {{.Config.Image}}' "$c" 2>/dev/null || echo missing)"
  case "$st" in running*) ok "$c: $st";; *) note "$c: $st";; esac
done
for img in yonixtools-web yonixtools-downloader; do
  docker image inspect "$img:latest" >/dev/null 2>&1 && ok "$img:latest present (deploy.sh keeps it as :previous for rollback)" || note "$img:latest missing (no rollback image on a first deploy)"
done

echo "Edge: yonixtools.com (main site) and ads.yonixtools.com (advertising only)"
if [ -f "$SITE_EDGE" ]; then
  grep -q "server_name yonixtools.com" "$SITE_EDGE" && ok "main site edge: server_name yonixtools.com" || bad "main site edge: no 'server_name yonixtools.com' in $SITE_EDGE"
  grep -q "ads.yonixtools.com" "$SITE_EDGE" && bad "main site edge mentions ads.yonixtools.com (should be its own file)" || ok "main site edge does not serve ads.yonixtools.com"
else bad "$SITE_EDGE missing"; fi
if [ -f "$ADS_EDGE" ]; then
  grep -q "server_name ads.yonixtools.com" "$ADS_EDGE" && ok "ad edge: server_name ads.yonixtools.com" || bad "ad edge: wrong server_name"
  # The web container serves the ad documents only when the Host header is ads.yonixtools.com.
  grep -A8 'location = /ad-frame.html' "$ADS_EDGE" | grep -q 'proxy_set_header Host \$host;' && ok "ad edge forwards Host (needed: the app serves ad documents only for ads.yonixtools.com)" || bad "ad edge /ad-frame.html does not forward 'Host \$host': ads would break after this deploy"
  if grep -q "location = /ad-test.html" "$ADS_EDGE"; then ok "ad edge has the admin ad-test route"; else note "ad edge has no /ad-test.html route yet: production answers 404 for it (safe). Optional, approval needed: bash deploy/scripts/setup-ads-origin.sh https"; fi
  grep -q 'location / { return 404; }' "$ADS_EDGE" && ok "ad edge serves nothing else (404)" || bad "ad edge may serve other paths"
else bad "$ADS_EDGE missing (ads.yonixtools.com not configured)"; fi
nginx -t >/dev/null 2>&1 && ok "nginx -t: current edge configuration valid" || bad "nginx -t fails on the current edge configuration"
for d in yonixtools.com ads.yonixtools.com; do
  exp="$(openssl x509 -enddate -noout -in "/etc/letsencrypt/live/$d/fullchain.pem" 2>/dev/null | cut -d= -f2)"
  [ -n "$exp" ] && ok "certificate $d valid until $exp" || note "no certificate at /etc/letsencrypt/live/$d (check the edge's ssl_certificate path)"
done
a="$(getent ahostsv4 yonixtools.com | awk 'NR==1{print $1}')"; b="$(getent ahostsv4 ads.yonixtools.com | awk 'NR==1{print $1}')"
[ -n "$a" ] && [ "$a" = "$b" ] && ok "DNS: yonixtools.com and ads.yonixtools.com both -> $a" || bad "DNS: yonixtools.com -> ${a:-none}, ads.yonixtools.com -> ${b:-none}"

echo "Configuration"
[ -s deploy/admin-auth/htpasswd ] && ok "admin password file present (/admin/ and /ad-test.html)" || note "no admin password file: /admin/ and /ad-test.html stay locked (bash deploy/scripts/admin-password.sh)"
[ -f services/downloader/.env ] && grep -q '^APP_ENV=production' services/downloader/.env && ok "downloader .env present, APP_ENV=production" || bad "services/downloader/.env missing or not APP_ENV=production"

echo "Data and other projects (listed only; the deploy never touches them)"
docker volume ls --format '{{.Name}}' | sed 's/^/        volume: /'
others="$(docker ps --format '{{.Names}}' | grep -v '^yonixtools-' | tr '\n' ' ')"
note "other running containers (left alone): ${others:-none}"
note "deploy.sh only builds/recreates the 'yonixtools' compose project's web and downloader; it never removes volumes"

echo
[ "$FAILED" = 0 ] && echo "Release check passed." || { echo "Release check FAILED: fix the items above before deploying."; exit 1; }
