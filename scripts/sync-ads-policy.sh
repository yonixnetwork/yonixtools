#!/usr/bin/env bash
# Copies the advertising policy (config/ads-policy.json, the single source of truth) into the two
# build contexts that cannot read the repository root: the website and the downloader image.
# Unit tests in both (apps/web/tests/unit/ads-policy.test.ts, services/downloader/tests/test_ad_eligibility.py)
# fail if a copy differs. Run after every edit of config/ads-policy.json:
#   bash scripts/sync-ads-policy.sh
set -euo pipefail
cd "$(dirname "$0")/.."
src=config/ads-policy.json
python3 -c 'import json,sys; json.load(open(sys.argv[1]))' "$src"
for dst in apps/web/src/lib/ads/ads-policy.json services/downloader/app/ads_policy.json; do
  cp "$src" "$dst"
  echo "synced $dst"
done
