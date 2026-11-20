#!/usr/bin/env bash
# Downloads, verifies and installs the DB-IP Lite country database used ONLY for ad eligibility
# (services/downloader/app/geoip.py). Runs ON THE HOST (the downloader container has an egress
# firewall and a read-only mount of the result). Monthly, e.g. root's crontab:
#   17 4 3 * *  cd /opt/yonixtools && bash deploy/scripts/update-geoip.sh >> /var/log/yonixtools-geoip.log 2>&1
# The downloader re-opens the file within a minute of a change: no restart needed.
#
# IP geolocation by DB-IP (https://db-ip.com), licensed under CC BY 4.0.
#
#   bash deploy/scripts/update-geoip.sh
# Env: GEOIP_DIR   install directory (default deploy/geoip, mounted by docker-compose.yml)
#      PYTHON      a Python with the maxminddb package for the check (default python3); without it
#                  the check runs inside the yonixtools-downloader image (no network); with neither
#                  the script stops and keeps the installed database.
#      GEOIP_MONTH YYYY-MM to fetch (default: this month, then last month)
# Exit status is non-zero on any failure; the installed database is then left as it was.
set -euo pipefail
cd "$(dirname "$0")/../.."
DIR="${GEOIP_DIR:-deploy/geoip}"
NAME=dbip-country-lite.mmdb
PY="${PYTHON:-python3}"
mkdir -p "$DIR"
chmod 755 "$DIR"
tmp="$(mktemp -d "$DIR/.update.XXXXXX")"   # same filesystem as the target: the final mv is atomic
trap 'rm -rf "$tmp"' EXIT

if [ -n "${GEOIP_MONTH:-}" ]; then months=("$GEOIP_MONTH")
else months=("$(date -u +%Y-%m)" "$(date -u -d "$(date -u +%Y-%m-15) -1 month" +%Y-%m)"); fi

got=""
for m in "${months[@]}"; do
  [[ "$m" =~ ^[0-9]{4}-[0-9]{2}$ ]] || { echo "update-geoip: bad month '$m'" >&2; exit 1; }
  url="https://download.db-ip.com/free/dbip-country-lite-$m.mmdb.gz"
  echo "==> $url"
  if curl -fsS --retry 3 --retry-delay 5 --max-time 300 -o "$tmp/db.mmdb.gz" "$url"; then got="$m"; break; fi
  echo "    not available, trying the previous month"
done
[ -n "$got" ] || { echo "update-geoip: download failed for ${months[*]}; installed database unchanged" >&2; exit 1; }

gunzip -t "$tmp/db.mmdb.gz" || { echo "update-geoip: corrupt gzip" >&2; exit 1; }
gunzip -c "$tmp/db.mmdb.gz" > "$tmp/$NAME"
chmod 755 "$tmp"; chmod 644 "$tmp/$NAME"   # readable by the container's unprivileged user (check and runtime)
size="$(stat -c %s "$tmp/$NAME")"
# The country database is about 8 MB unpacked; anything far outside that is not it.
if [ "$size" -lt 2000000 ] || [ "$size" -gt 200000000 ]; then echo "update-geoip: unexpected size $size bytes" >&2; exit 1; fi

CHECK='
import sys, time, maxminddb
r = maxminddb.open_database(sys.argv[1])
m = r.metadata()
assert "country" in m.database_type.lower(), "not a country database: " + m.database_type
assert m.ip_version == 6, "expected an IPv4+IPv6 database"
age = (time.time() - m.build_epoch) / 86400
assert -2 < age < 100, "database build date is %.0f days old" % age
for ip in ("8.8.8.8", "1.1.1.1"):
    rec = r.get(ip) or {}
    cc = (rec.get("country") or {}).get("iso_code")
    assert isinstance(cc, str) and len(cc) == 2, "no country for " + ip
assert r.get("10.0.0.1") is None, "private address must not resolve"
print("    verified: %s, built %s, %d nodes" % (m.database_type, time.strftime("%Y-%m-%d", time.gmtime(m.build_epoch)), m.node_count))
'
if "$PY" -c 'import maxminddb' 2>/dev/null; then
  "$PY" -I -c "$CHECK" "$tmp/$NAME" || { echo "update-geoip: verification failed" >&2; exit 1; }
elif command -v docker >/dev/null && docker image inspect yonixtools-downloader:latest >/dev/null 2>&1; then
  docker run --rm --network none --read-only -v "$(cd "$tmp" && pwd):/check:ro" --entrypoint python yonixtools-downloader:latest -I -c "$CHECK" "/check/$NAME" \
    || { echo "update-geoip: verification failed" >&2; exit 1; }
else
  echo "update-geoip: no Python with maxminddb and no yonixtools-downloader image to verify with; installed database unchanged" >&2; exit 1
fi

[ -f "$DIR/$NAME" ] && cp -p "$DIR/$NAME" "$DIR/$NAME.previous"
mv -f "$tmp/$NAME" "$DIR/$NAME"
sha="$(sha256sum "$DIR/$NAME" | cut -d' ' -f1)"
printf 'month=%s\nsource=https://download.db-ip.com/free/dbip-country-lite-%s.mmdb.gz\nsha256=%s\ninstalled=%s\nattribution=IP geolocation by DB-IP (https://db-ip.com), licensed under CC BY 4.0\n' \
  "$got" "$got" "$sha" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$DIR/VERSION"
echo "==> Installed $DIR/$NAME ($got, $size bytes, sha256 $sha); previous copy: $DIR/$NAME.previous"
