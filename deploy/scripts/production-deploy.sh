#!/usr/bin/env bash
# Production deployment of ONE approved commit, run ON THE SERVER (piped over SSH by
# .github/workflows/deploy.yml, or by hand). Every guard runs before anything changes.
#
#   bash production-deploy.sh <checkout-dir> <full-commit-sha> --dry-run   # guards only
#   bash production-deploy.sh <checkout-dir> <full-commit-sha> --deploy    # real deployment
# One of the two flags is REQUIRED: without it nothing runs, so a forgotten flag can never deploy.
#
# Guards (each one stops the deploy):
#  1. <checkout-dir> is the YoniXTools checkout: origin is yonixnetwork/yonixtools, the compose project
#     is "yonixtools", and the path is not a YonixAlpha directory. Nothing outside this checkout and the
#     "yonixtools" compose project is ever touched (no YonixAlpha containers, images or volumes).
#  2. The commit exists and is already merged into origin/main (= reviewed and approved).
#  3. No local changes to tracked files.
#  4. The downloader .env (APP_ENV=production) and the admin password file exist.
#  5. After checkout: deploy/scripts/release-check.sh (exact commit, disk, edge, certificates, DNS).
# Then: a dated backup in /root/yonixtools-backups (config archive, previous commit, image ids), permanent
# rollback tags for the running images, and deploy.sh with the production settings fixed here:
# https://yonixtools.com, AD_ORIGIN=https://ads.yonixtools.com, Monetag OFF.
# Optional deploy/production.env on the server (git-ignored) may set ONLY the search-engine
# verification codes, so they survive every deploy:
#   GOOGLE_SITE_VERIFICATION=<code>
#   BING_SITE_VERIFICATION=<code>
# Any other line in it stops the deploy.
# --dry-run: run guards 1–4 and print the plan. It changes no files, containers or images; it only
# fetches from GitHub into this checkout's .git.
set -euo pipefail
DIR="${1:?checkout directory}"; COMMIT="${2:?commit sha}"; MODE="${3:-}"
REPO_RE='^(https://github[.]com/|ssh://git@github[.]com/|git@github[.]com:|(git@)?github-yonixtools:)yonixnetwork/yonixtools([.]git)?/?$'
SITE_URL=https://yonixtools.com
AD_ORIGIN=https://ads.yonixtools.com
stop() { echo "STOP: $*" >&2; exit 1; }

[[ "$COMMIT" =~ ^[0-9a-f]{40}$ ]] || stop "commit must be a full 40-character sha (got '$COMMIT')"
[ "$MODE" = --dry-run ] || [ "$MODE" = --deploy ] || stop "say what to do: --dry-run (guards only) or --deploy (real deployment); got '${MODE:-nothing}'"
[ "$#" -le 3 ] || stop "too many arguments"

echo "==> Guard 1: this is the YoniXTools checkout, nothing else"
case "$DIR" in *[Yy]onix[Aa]lpha*) stop "refusing a YonixAlpha path: $DIR";; esac
cd "$DIR" || stop "no such directory: $DIR"
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || stop "$DIR is not a git checkout"
[ "$(git rev-parse --show-toplevel)" = "$(pwd -P)" ] || stop "$DIR is not the top of the checkout"
url="$(git config --get remote.origin.url || true)"   # as configured (not rewritten by insteadOf)
[[ "$url" =~ $REPO_RE ]] || stop "origin is '$url', not yonixnetwork/yonixtools"
grep -qx 'name: yonixtools' deploy/docker-compose.yml || stop "deploy/docker-compose.yml is not the 'yonixtools' compose project"

echo "==> Guard 2: the commit is approved (merged into main)"
git fetch --quiet origin main || stop "cannot fetch origin/main (network or GitHub problem); nothing changed"
git cat-file -e "$COMMIT^{commit}" 2>/dev/null || git fetch --quiet origin "$COMMIT" || stop "commit $COMMIT not found on origin"
git merge-base --is-ancestor "$COMMIT" origin/main || stop "commit $COMMIT is not merged into main: merge (and review) it first"
short="$(git rev-parse --short=7 "$COMMIT")"

echo "==> Guard 3: no local changes"
[ -z "$(git status --porcelain --untracked-files=no)" ] || { git status --short; stop "local changes to tracked files"; }

echo "==> Guard 4: production configuration present"
[ -s services/downloader/.env ] || stop "services/downloader/.env missing"
grep -q '^APP_ENV=production' services/downloader/.env || stop "APP_ENV is not production"
[ -s deploy/admin-auth/htpasswd ] || stop "deploy/admin-auth/htpasswd missing (admin area would be locked)"

verify_env=()
if [ -f deploy/production.env ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in ""|\#*) continue;; esac
    [[ "$line" =~ ^(GOOGLE_SITE_VERIFICATION|BING_SITE_VERIFICATION)=([A-Za-z0-9_-]{8,128})$ ]] || stop "deploy/production.env: only GOOGLE_SITE_VERIFICATION=<code> and BING_SITE_VERIFICATION=<code> are allowed (got '${line%%=*}')"
    verify_env+=("$line")
  done < deploy/production.env
  echo "    search verification codes: ${#verify_env[@]} from deploy/production.env"
fi

current="$(git rev-parse --short=7 HEAD)"
echo "Plan: $current -> $short ($(git log -1 --format=%s "$COMMIT"))"
echo "      site $SITE_URL, ads $AD_ORIGIN, Monetag off; only the 'yonixtools' compose project"
if [ "$MODE" = --dry-run ]; then echo "DRY RUN: guards passed, nothing deployed (only this checkout's .git was updated by the fetch)."; exit 0; fi
[ "$current" != "$short" ] || stop "$short is already checked out; nothing to deploy"

echo "==> Backup (config, previous commit, image ids) and permanent rollback tags"
B="/root/yonixtools-backups/$(date -u +%Y%m%d-%H%M%S)-before-$short"
install -d -m 700 "$B"
files=(services/downloader/.env deploy/admin-auth/htpasswd); [ -d deploy/state ] && files+=(deploy/state)
tar czf "$B/config.tgz" "${files[@]}"; chmod 600 "$B/config.tgz"
tar tzf "$B/config.tgz" > "$B/config.list"
grep -qx 'services/downloader/.env' "$B/config.list" && grep -qx 'deploy/admin-auth/htpasswd' "$B/config.list" || stop "backup archive incomplete"
echo "$current" > "$B/production-commit"
for img in yonixtools-web yonixtools-downloader; do
  if docker image inspect "$img:latest" >/dev/null 2>&1; then
    docker tag "$img:latest" "$img:rollback-$current"
    echo "$img $(docker image inspect -f '{{.Id}}' "$img:latest")" >> "$B/images.txt"
  fi
done
echo "$B" > /root/yonixtools-backups/LATEST
echo "    backup: $B (rollback tags: :rollback-$current)"

echo "==> Checkout and release check"
git checkout --quiet --detach "$COMMIT"
EXPECT_COMMIT="$short" bash deploy/scripts/release-check.sh || { git checkout --quiet --detach "$current"; stop "release check failed; checkout restored to $current, nothing deployed"; }

echo "==> Deploy $short"
# Production settings are fixed here; nothing from the caller's environment can change them.
env -u MONETAG -u ADS -u AD_FRAME_PARENT -u GOOGLE_SITE_VERIFICATION -u BING_SITE_VERIFICATION \
  SITE_URL="$SITE_URL" AD_ORIGIN="$AD_ORIGIN" MONETAG=off "${verify_env[@]}" \
  bash deploy/scripts/deploy.sh || stop "deploy failed. Roll back: cd $DIR && bash deploy/scripts/rollback.sh && git checkout --detach $current"
echo "DEPLOYED $short (previous $current; backup $B)"
