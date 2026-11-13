#!/usr/bin/env bash
# Tests the guards of deploy/scripts/production-deploy.sh in --dry-run mode, against a throwaway
# clone of this repository. Never touches Docker, the server, or this checkout.
#   bash deploy/tests/production-deploy-guards.sh
set -uo pipefail
here="$(cd "$(dirname "$0")/../.." && pwd)"
script="$here/deploy/scripts/production-deploy.sh"
work="$(mktemp -d)"; trap 'rm -rf "$work"' EXIT
# A local stand-in for GitHub: fetches from https://github.com/yonixnetwork/yonixtools go to this
# bare mirror (no network), while origin's configured URL stays the real one the guard checks.
git clone -q --bare "$here" "$work/origin.git"
git -C "$work/origin.git" update-ref refs/heads/main "$(git -C "$here" rev-parse HEAD)"
pass=0; fail=0
expect() { # expect <ok|stop> <label> <dir> <commit> [extra args]
  local want="$1" label="$2"; shift 2
  local out rc; out="$(bash "$script" "$@" --dry-run 2>&1)"; rc=$?
  if { [ "$want" = ok ] && [ $rc = 0 ] && grep -q "DRY RUN: guards passed" <<<"$out"; } || { [ "$want" = stop ] && [ $rc != 0 ] && grep "^STOP:" <<<"$out" | grep -qF -- "${WHY:-STOP:}"; }; then
    echo "  PASS  $label"; pass=$((pass+1))
  else
    echo "  FAIL  $label (exit $rc)"; sed 's/^/        /' <<<"$out" | tail -5; fail=$((fail+1))
  fi
}
mk() { # a fresh clone at main with production-like untracked config
  local d="$work/$1"; git clone -q "$work/origin.git" "$d" && git -C "$d" remote set-url origin https://github.com/yonixnetwork/yonixtools
  git -C "$d" config url."$work/origin.git".insteadOf https://github.com/yonixnetwork/yonixtools
  git -C "$d" fetch -q origin main && git -C "$d" checkout -q --detach origin/main
  mkdir -p "$d/deploy/admin-auth"; echo 'APP_ENV=production' > "$d/services/downloader/.env"; echo 'admin:$apr1$x$y' > "$d/deploy/admin-auth/htpasswd"
  echo "$d"
}

d="$(mk ok)"; main="$(git -C "$d" rev-parse origin/main)"; merged="$(git -C "$d" rev-parse --verify -q 'origin/main~1^{commit}')"
expect ok   "approved commit (main) passes all guards"            "$d" "$main"
expect ok   "an older commit merged into main passes"              "$d" "$merged"
WHY="full 40-character sha" expect stop "short sha refused"                                    "$d" "${main:0:7}"
WHY="not found on origin" expect stop "unknown commit refused"                               "$d" 0000000000000000000000000000000000000000
git -C "$d" -c user.email=t@t -c user.name=t commit -q --allow-empty -m "unmerged"; unmerged="$(git -C "$d" rev-parse HEAD)"
WHY="not merged into main" expect stop "commit not merged into main refused"                  "$d" "$unmerged"
git -C "$d" checkout -q --detach origin/main
echo x >> "$d/README.md";  WHY="local changes" expect stop "local changes refused"     "$d" "$main"; git -C "$d" checkout -q -- README.md
mv "$d/deploy/admin-auth/htpasswd" "$work/h"; WHY="htpasswd missing" expect stop "missing admin password refused" "$d" "$main"; mv "$work/h" "$d/deploy/admin-auth/htpasswd"
sed -i 's/production/development/' "$d/services/downloader/.env"; WHY="APP_ENV is not production" expect stop "APP_ENV not production refused" "$d" "$main"; echo 'APP_ENV=production' > "$d/services/downloader/.env"
echo 'AD_ORIGIN=https://evil.example' > "$d/deploy/production.env"; WHY="only GOOGLE_SITE_VERIFICATION" expect stop "production.env can't override AD_ORIGIN" "$d" "$main"
echo 'MONETAG=on' > "$d/deploy/production.env"; WHY="only GOOGLE_SITE_VERIFICATION" expect stop "production.env can't enable Monetag" "$d" "$main"
printf 'GOOGLE_SITE_VERIFICATION=abcDEF123_-xyz\nBING_SITE_VERIFICATION=0123456789ABCDEF\n' > "$d/deploy/production.env"; expect ok "production.env with only verification codes accepted" "$d" "$main"; rm "$d/deploy/production.env"
for u in https://github.com/yonixnetwork/yonixtools.git git@github.com:yonixnetwork/yonixtools.git github-yonixtools:yonixnetwork/yonixtools git@github-yonixtools:yonixnetwork/yonixtools.git; do
  git -C "$d" remote set-url origin "$u"; git -C "$d" config url."$work/origin.git".insteadOf "$u"; expect ok "origin form accepted: $u" "$d" "$main"
done
for u in https://github.com/someone/yonixalpha https://github.com/yonixnetwork/yonixtools-fork https://evil.example/yonixnetwork/yonixtools; do
  git -C "$d" remote set-url origin "$u"; WHY="not yonixnetwork/yonixtools" expect stop "wrong repository refused: $u" "$d" "$main"
done
git -C "$d" remote set-url origin https://github.com/yonixnetwork/yonixtools
git -C "$d" remote set-url origin https://github.com/yonixnetwork/yonixtools
sed -i 's/^name: yonixtools$/name: yonixalpha/' "$d/deploy/docker-compose.yml"; WHY="not the 'yonixtools' compose project" expect stop "other compose project refused" "$d" "$main"; git -C "$d" checkout -q -- deploy/docker-compose.yml
ya="$work/opt-yonixalpha"; cp -a "$d" "$ya"; WHY="refusing a YonixAlpha path" expect stop "YonixAlpha path refused" "$ya" "$main"
WHY="not a git checkout" expect stop "not a checkout refused" "$work" "$main"

echo "Result: $pass passed, $fail failed"
[ "$fail" = 0 ]
