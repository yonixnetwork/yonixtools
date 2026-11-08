#!/usr/bin/env bash
# Serve a built site locally through the REAL production nginx config
# (deploy/nginx/web.conf + security-headers.conf, build options applied exactly as
# in the Docker image), so headers/CSP/sandbox tests see what production would send.
#   scripts/nginx-local.sh start <out-dir> <port> [<port2> ...]   (env: AD_ORIGIN, AD_FRAME_PARENT, MONETAG, SITE_URL)
#   scripts/nginx-local.sh stop
set -euo pipefail
here="$(cd "$(dirname "$0")/../../.." && pwd)"
dir="${NGINX_LOCAL_DIR:-/tmp/ytx-nginx-local}"
case "${1:-}" in
  stop) [ -f "$dir/nginx.pid" ] && nginx -p "$dir" -c "$dir/nginx.conf" -s stop 2>/dev/null || true; exit 0 ;;
  start) ;;
  *) echo "usage: $0 start <out-dir> <port>... | stop" >&2; exit 2 ;;
esac
out="$(cd "$2" && pwd)"; shift 2
rm -rf "$dir"; mkdir -p "$dir/snippets" "$dir/conf.d" "$dir/tmp"
cp "$here/deploy/nginx/security-headers.conf" "$dir/snippets/security-headers.conf"
cp "$here/deploy/nginx/web.conf" "$dir/conf.d/web.conf"
SITE_URL="${SITE_URL:-https://yonixtools.com}" sh "$here/deploy/nginx/apply-build-options.sh" "$dir/snippets/security-headers.conf" "$dir/conf.d/web.conf"
listens=""; for p in "$@"; do listens="$listens    listen 127.0.0.1:$p;\n"; done
sed -i -e "s#^    listen 80;#$listens#" -e "s#root /usr/share/nginx/html;#root $out;#" -e "s#/etc/nginx/snippets/#$dir/snippets/#g" "$dir/conf.d/web.conf"
cat > "$dir/nginx.conf" <<CONF
worker_processes 1;
pid $dir/nginx.pid;
error_log $dir/error.log warn;
events { worker_connections 256; }
http {
  include /etc/nginx/mime.types;
  default_type application/octet-stream;
  access_log off;
  client_body_temp_path $dir/tmp; proxy_temp_path $dir/tmp; fastcgi_temp_path $dir/tmp; uwsgi_temp_path $dir/tmp; scgi_temp_path $dir/tmp;
  include $dir/conf.d/web.conf;
}
CONF
nginx -t -p "$dir" -c "$dir/nginx.conf" 2>&1 | tail -1
nginx -p "$dir" -c "$dir/nginx.conf"
echo "nginx serving $out on: $*"
