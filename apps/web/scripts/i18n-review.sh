#!/usr/bin/env bash
# Record that a named person reviewed translations (and so may make pages indexable).
#   bash scripts/i18n-review.sh <locale> "<ns>:<key glob>" "<Reviewer name>"
#   bash scripts/i18n-review.sh es "registry:tool.pdf-merger.*" "Ana García"
# Only run this after a person has actually read and approved the translations. The record stores
# hashes of the English source and the translation: changing either text invalidates it.
set -euo pipefail
[ "$#" = 3 ] || { echo "usage: $0 <locale> <ns:key-glob> <reviewer name>" >&2; exit 2; }
cd "$(dirname "$0")/.."
I18N_REVIEW_LOCALE="$1" I18N_REVIEW_KEYS="$2" I18N_REVIEWER="$3" npx vitest run tests/unit/i18n-report.test.ts -t "record a human review"
