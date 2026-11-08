#!/bin/sh
# Applies build options to the nginx security config inside the web image.
# With no options set (the production default) the files are left unchanged.
#   $1 = security-headers.conf (page CSP)   $2 = web.conf (ad frame CSP)
# Env:
#   AD_ORIGIN         separate ad-frame origin, e.g. https://yonixtools.com:8443
#                     -> page CSP: frame-src 'self' <AD_ORIGIN>   (exactly one origin)
#                     -> ad frame CSP: frame-ancestors 'self' <AD_FRAME_PARENT>
#   AD_FRAME_PARENT   the site that embeds the ad frame (default: SITE_URL)
#   MONETAG=on        stage-1 Monetag CSP, approved for STAGING ONLY on 8 Nov 2026:
#                     script-src and connect-src gain exactly https://n6wxm.com https://nap5k.com
set -eu
page="$1"; frame="$2"
origin_re='^https?://[A-Za-z0-9.-]+(:[0-9]{1,5})?$'
check() { printf '%s' "$2" | grep -Eq "$origin_re" || { echo "apply-build-options: invalid $1: '$2'" >&2; exit 1; }; }
must() { grep -qF -- "$2" "$1" || { echo "apply-build-options: expected text not found in $1: $2" >&2; exit 1; }; }

if [ -n "${AD_ORIGIN:-}" ]; then
  parent="${AD_FRAME_PARENT:-${SITE_URL:-}}"
  check AD_ORIGIN "$AD_ORIGIN"; check AD_FRAME_PARENT "$parent"
  must "$page" "connect-src 'self' data: blob:; worker-src"
  sed -i "s#; worker-src 'self' blob:;#; frame-src 'self' $AD_ORIGIN; worker-src 'self' blob:;#" "$page"
  must "$frame" "frame-ancestors 'self';"
  sed -i "s#frame-ancestors 'self';#frame-ancestors 'self' $parent;#" "$frame"
  must "$page" "frame-src 'self' $AD_ORIGIN;"; must "$frame" "frame-ancestors 'self' $parent;"
  echo "apply-build-options: ad frame origin $AD_ORIGIN, embeddable by $parent"
fi

if [ "${MONETAG:-off}" = "on" ]; then
  must "$page" "'wasm-unsafe-eval'; style-src"
  sed -i "s#'wasm-unsafe-eval'; style-src#'wasm-unsafe-eval' https://n6wxm.com https://nap5k.com; style-src#" "$page"
  sed -i "s#connect-src 'self' data: blob:;#connect-src 'self' data: blob: https://n6wxm.com https://nap5k.com;#" "$page"
  must "$page" "'wasm-unsafe-eval' https://n6wxm.com https://nap5k.com; style-src"; must "$page" "connect-src 'self' data: blob: https://n6wxm.com https://nap5k.com;"
  echo "apply-build-options: Monetag stage-1 CSP (staging only)"
fi

# Guard rails, whatever the options: never a blanket frame/script permission or eval.
if grep -Eq "frame-src[^;]* https:( |;)|script-src[^;]* https:( |;)|'unsafe-eval'|script-src[^;]*\*" "$page"; then
  echo "apply-build-options: refusing a broad CSP permission" >&2; exit 1
fi
