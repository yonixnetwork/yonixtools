#!/usr/bin/env bash
# Post-deploy smoke test. Read-only except for one tiny downloader job.
#   deploy/scripts/smoke-test.sh https://yonixtools.com
# Options (env): SITE_HOST=yonixtools.com (when BASE is an IP), RESOLVE="yonixtools.com:443:1.2.3.4" (test before DNS switch),
#                INSECURE=1 (self-signed certs), SAMPLE_URL=<public post to download>.
set -uo pipefail
BASE="${1:-https://yonixtools.com}"
# Hostname that canonical URLs use (differs when testing via 127.0.0.1).
HOST="${SITE_HOST:-$(echo "$BASE" | sed -E 's#^https?://([^/:]+).*#\1#')}"
args=(-s --max-time 20 --noproxy '*')
[ -n "${RESOLVE:-}" ] && for r in $RESOLVE; do args+=(--resolve "$r"); done
[ "${INSECURE:-0}" = "1" ] && args+=(-k)
pass=0; fail=0
ok()  { echo "  PASS  $1"; pass=$((pass+1)); }
bad() { echo "  FAIL  $1"; fail=$((fail+1)); }
code() { curl "${args[@]}" -o /dev/null -w '%{http_code}' "$@"; }
check() { local want="$1" label="$2"; shift 2; local got; got="$(code "$@")"; [ "$got" = "$want" ] && ok "$label ($got)" || bad "$label (expected $want, got $got)"; }

echo "Smoke test: $BASE"
echo "Pages"
for p in / /tools/ /instagram-downloader/ /youtube-downloader/ /pdf-merger/ /qr-code-generator/ /category/pdf-tools/ /privacy/; do check 200 "GET $p" "$BASE$p"; done
check 404 "unknown page is 404" "$BASE/definitely-not-a-page/"
check 301 "missing trailing slash redirects" "$BASE/pdf-merger"
sm="$(curl "${args[@]}" "$BASE/sitemap.xml")"; echo "$sm" | grep -q "<loc>https://$HOST/pdf-merger/</loc>" && ok "sitemap lists tool pages" || bad "sitemap"
curl "${args[@]}" "$BASE/robots.txt" | grep -q "Sitemap: https://$HOST/sitemap.xml" && ok "robots.txt points to sitemap" || bad "robots.txt"

echo "Headers"
hdr="$(curl "${args[@]}" -D - -o /dev/null "$BASE/")"
for h in content-security-policy x-content-type-options x-frame-options referrer-policy permissions-policy; do echo "$hdr" | grep -qi "^$h:" && ok "$h" || bad "$h missing"; done
[[ "$BASE" == https://* ]] && { echo "$hdr" | grep -qi "^strict-transport-security:" && ok "HSTS" || bad "HSTS missing"; }
echo "$hdr" | grep -qiE "^server: .*[0-9]" && bad "server version exposed" || ok "no server version"
asset="$(curl "${args[@]}" "$BASE/" | grep -o '/_next/static/[^"]*\.js' | head -1)"
curl "${args[@]}" -D - -o /dev/null -H 'Accept-Encoding: gzip' "$BASE$asset" | grep -qi "immutable" && ok "static assets cached immutably" || bad "static asset caching"

# Pages keep the strict policy: scripts only from this site (ads run in the isolated frame).
echo "$hdr" | grep -i "^content-security-policy:" | grep -q "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval';" && ok "pages keep the strict CSP" || bad "page CSP changed"

echo "Advertising frame and PWA"
check 200 "GET /ad-frame.html" "$BASE/ad-frame.html"
afh="$(curl "${args[@]}" -D - -o /dev/null "$BASE/ad-frame.html")"
echo "$afh" | grep -i "^content-security-policy:" | grep -q "frame-ancestors 'self'" && ok "ad frame has its own CSP (framable by this site only)" || bad "ad frame CSP"
curl "${args[@]}" "$BASE/ad-frame.html" | grep -q "bellnewyork.org/22/620b3190e30ed523091b51770aea0b40" && ok "ad frame contains the publisher units" || bad "ad frame units"
check 200 "GET /manifest.webmanifest" "$BASE/manifest.webmanifest"
curl "${args[@]}" -D - -o /dev/null "$BASE/manifest.webmanifest" | grep -qi "^content-type: application/manifest+json" && ok "manifest content type" || bad "manifest content type"
curl "${args[@]}" -D - -o /dev/null "$BASE/sw.js" | grep -qi "^cache-control: no-cache" && ok "service worker is always revalidated" || bad "sw.js caching"
check 200 "GET /icons/icon-512.png" "$BASE/icons/icon-512.png"
check 200 "GET /offline/" "$BASE/offline/"

echo "Downloader API"
check 200 "GET /api/healthz" "$BASE/api/healthz"
check 200 "GET /api/readyz" "$BASE/api/readyz"
check 404 "/api/internal is not exposed" "$BASE/api/internal/stats"
check 422 "unsafe URL rejected" -X POST -H 'content-type: application/json' -d '{"url":"http://169.254.169.254/latest/meta-data/"}' "$BASE/api/v1/extract"
check 422 "unsupported platform rejected" -X POST -H 'content-type: application/json' -d '{"url":"https://example.com/x.mp4"}' "$BASE/api/v1/extract"
big="$(head -c 20000 /dev/zero | tr '\0' a)"
c="$(code -X POST -H 'content-type: application/json' --data "{\"url\":\"$big\"}" "$BASE/api/v1/extract")"; [[ "$c" = 413 ]] && ok "oversized body rejected ($c)" || bad "oversized body (got $c)"
if [ -n "${SAMPLE_URL:-}" ]; then
  ex="$(curl "${args[@]}" -X POST -H 'content-type: application/json' -d "{\"url\":\"$SAMPLE_URL\"}" "$BASE/api/v1/extract")"
  fid="$(echo "$ex" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["items"][0]["formats"][-1]["id"])' 2>/dev/null)"
  if [ -n "$fid" ]; then
    ok "extract $SAMPLE_URL"
    job="$(curl "${args[@]}" -X POST -H 'content-type: application/json' -d "{\"url\":\"$SAMPLE_URL\",\"itemIndex\":0,\"formatId\":\"$fid\"}" "$BASE/api/v1/jobs" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])' 2>/dev/null)"
    st=""; for _ in $(seq 1 120); do st="$(curl "${args[@]}" "$BASE/api/v1/jobs/$job" | python3 -c 'import json,sys; print(json.load(sys.stdin)["status"])' 2>/dev/null)"; [[ "$st" = "done" || "$st" = "failed" ]] && break; sleep 2; done
    if [ "$st" = "done" ]; then sz="$(curl "${args[@]}" -o /dev/null -w '%{size_download}' "$BASE/api/v1/jobs/$job/file")"; [ "${sz:-0}" -gt 0 ] && ok "download delivered ($sz bytes)" || bad "download empty"; else bad "job ended as '$st'"; fi
  else bad "extract $SAMPLE_URL: $(echo "$ex" | head -c 200)"; fi
else echo "  SKIP  real download (set SAMPLE_URL to a public post)"; fi

echo; echo "Result: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
