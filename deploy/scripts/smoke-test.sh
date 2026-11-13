#!/usr/bin/env bash
# Post-deploy smoke test. Read-only except for one tiny downloader job.
#   deploy/scripts/smoke-test.sh https://yonixtools.com
# Options (env): SITE_HOST=yonixtools.com (when BASE is an IP), RESOLVE="yonixtools.com:443:1.2.3.4" (test before DNS switch),
#                INSECURE=1 (self-signed certs), SAMPLE_URL=<public post to download>,
#                AD_HOST=ads.yonixtools.com (check the ad origin through the same address, by Host header).
set -uo pipefail
BASE="${1:-https://yonixtools.com}"
# Hostname that canonical URLs use (differs when testing via 127.0.0.1).
HOST="${SITE_HOST:-$(echo "$BASE" | sed -E 's#^https?://([^/:]+).*#\1#')}"
args=(-s --max-time 20 --noproxy '*')
[ -n "${RESOLVE:-}" ] && for r in $RESOLVE; do args+=(--resolve "$r"); done
[ "${INSECURE:-0}" = "1" ] && args+=(-k)
[ -n "${CURL_AUTH:-}" ] && args+=(-u "$CURL_AUTH")   # staging password (user:password)
pass=0; fail=0
ok()  { echo "  PASS  $1"; pass=$((pass+1)); }
bad() { echo "  FAIL  $1"; fail=$((fail+1)); }
note() { echo "  NOTE  $1"; }
code() { curl "${args[@]}" -o /dev/null -w '%{http_code}' "$@"; }
# has [-i] PATTERN CURL_ARGS...: fetch the whole response, then match it without a pipe.
# ("curl | grep -q" fails under pipefail when grep exits early and curl gets SIGPIPE:
# a false FAIL that depends on response size and timing.)
has() { local flags=-q; [ "$1" = "-i" ] && { flags=-qi; shift; }; local pat="$1"; shift; local out; out="$(curl "${args[@]}" "$@")"; grep "$flags" -- "$pat" <<<"$out"; }
check() { local want="$1" label="$2"; shift 2; local got; got="$(code "$@")"; [ "$got" = "$want" ] && ok "$label ($got)" || bad "$label (expected $want, got $got)"; }

echo "Smoke test: $BASE"
echo "Pages"
for p in / /tools/ /instagram-downloader/ /youtube-downloader/ /pdf-merger/ /qr-code-generator/ /category/pdf-tools/ /privacy/; do check 200 "GET $p" "$BASE$p"; done
check 404 "unknown page is 404" "$BASE/definitely-not-a-page/"
check 301 "missing trailing slash redirects" "$BASE/pdf-merger"
has "<loc>https://$HOST/pdf-merger/</loc>" "$BASE/sitemap.xml" && ok "sitemap lists tool pages" || bad "sitemap"
if [ "${STAGING:-0}" = "1" ]; then has "^Disallow: /$" "$BASE/robots.txt" && ok "staging robots.txt blocks all crawlers" || bad "staging robots.txt"
else has "Sitemap: https://$HOST/sitemap.xml" "$BASE/robots.txt" && ok "robots.txt points to sitemap" || bad "robots.txt"; fi

echo "Headers"
hdr="$(curl "${args[@]}" -D - -o /dev/null "$BASE/")"
for h in content-security-policy x-content-type-options x-frame-options referrer-policy permissions-policy; do echo "$hdr" | grep -qi "^$h:" && ok "$h" || bad "$h missing"; done
[[ "$BASE" == https://* ]] && { echo "$hdr" | grep -qi "^strict-transport-security:" && ok "HSTS" || bad "HSTS missing"; }
echo "$hdr" | grep -qiE "^server: .*[0-9]" && bad "server version exposed" || ok "no server version"
asset="$(curl "${args[@]}" "$BASE/" | grep -o '/_next/static/[^"]*\.js' | head -1)"
has -i "immutable" -D - -o /dev/null -H 'Accept-Encoding: gzip' "$BASE$asset" && ok "static assets cached immutably" || bad "static asset caching"

# Pages keep the strict policy: scripts only from this site, never eval or blanket https/wildcard permissions.
csp="$(echo "$hdr" | grep -i "^content-security-policy:")"
if echo "$csp" | grep -q "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval';" && ! echo "$csp" | grep -Eq "'unsafe-eval'|script-src[^;]* https:|frame-src[^;]* https:( |;)|\*"; then ok "pages keep the strict CSP (scripts from this site only)"; else bad "page CSP changed or broadened"; fi
# Ads run only in the separate ad origin: the page may frame exactly that one origin (when configured).
fsrc="$(echo "$csp" | grep -o "frame-src [^;]*" || true)"; [ -z "$fsrc" ] && note "page CSP: no ad origin configured (ads off)" || { echo "$fsrc" | grep -Eq "^frame-src 'self' https?://[A-Za-z0-9.:-]+$" && ok "page CSP frames exactly one ad origin" || bad "page frame-src: $fsrc"; }

echo "Admin area and removed pages"
noauth=(-s --max-time 20 --noproxy '*'); [ -n "${RESOLVE:-}" ] && for r in $RESOLVE; do noauth+=(--resolve "$r"); done; [ "${INSECURE:-0}" = "1" ] && noauth+=(-k)
adm="$(curl "${noauth[@]}" -o /dev/null -w '%{http_code}' "$BASE/admin/ads/")"
case "$adm" in 401) ok "admin page requires a password (401)";; 500) note "admin area locked: no password file yet (run deploy/scripts/admin-password.sh)";; *) bad "admin page reachable without password ($adm)";; esac
# Behind the staging gate these are asked WITH the staging login, so the app itself answers.
[ "$(code "$BASE/ads-check/")" = 404 ] && ok "old public ads test page is gone (404)" || bad "public /ads-check/ still served"
[ "$(code "$BASE/api/internal/stats")" = 404 ] && ok "internal API not exposed" || bad "internal API exposed"

echo "Advertising documents"
# The site's own origin never serves the ad documents, under any spelling or query.
for p in /ad-frame.html /ad-test.html "/ad-frame.html?u=native&s=x" "/ad-test.html?u=monetagPush" /ad-frame.html/ /ad-test; do check 404 "site origin: $p" "$BASE$p"; done
# The ad origin (AD_HOST=ads.yonixtools.com, sent as the Host header) serves its two documents and nothing else.
if [ -n "${AD_HOST:-}" ]; then
  ah=(-H "Host: $AD_HOST")
  check 200 "ad origin: GET /ad-frame.html" "${ah[@]}" "$BASE/ad-frame.html"
  afh="$(curl "${args[@]}" "${ah[@]}" -D - -o /dev/null "$BASE/ad-frame.html")"
  echo "$afh" | grep -i "^content-security-policy:" | grep -Eq "frame-ancestors 'self'( https?://[A-Za-z0-9.:-]+)?;" && ok "ad frame has its own CSP (framable by this site only)" || bad "ad frame CSP"
  has "bellnewyork.org/22/620b3190e30ed523091b51770aea0b40" "${ah[@]}" "$BASE/ad-frame.html" && ok "ad frame contains the publisher units" || bad "ad frame units"
  afb="$(curl "${args[@]}" "${ah[@]}" "$BASE/ad-frame.html")"
  if grep -Eq "data-ytx-ui|__ytxReport|admin-top|requests\(\)" <<<"$afb"; then bad "public ad frame contains diagnostics"; else ok "public ad frame has no diagnostics"; fi
  for p in /ad-test.html "/ad-test.html?u=monetagPush"; do
    t="$(curl "${noauth[@]}" "${ah[@]}" -o /dev/null -w '%{http_code}' "$BASE$p")"
    [ "$t" = 401 ] && ok "ad origin: $p requires the admin password (401)" || bad "ad origin: $p without password ($t)"
  done
  for p in / /admin/ads/ /api/healthz /tools/ /sw.js; do check 404 "ad origin serves nothing else: $p" "${ah[@]}" "$BASE$p"; done
else
  note "AD_HOST not set (no ad origin configured): ad-origin checks skipped"
fi

echo "PWA"
check 200 "GET /manifest.webmanifest" "$BASE/manifest.webmanifest"
has -i "^content-type: application/manifest+json" -D - -o /dev/null "$BASE/manifest.webmanifest" && ok "manifest content type" || bad "manifest content type"
has -i "^cache-control: no-cache" -D - -o /dev/null "$BASE/sw.js" && ok "service worker is always revalidated" || bad "sw.js caching"
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
