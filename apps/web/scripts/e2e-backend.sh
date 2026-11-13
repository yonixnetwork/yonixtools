#!/usr/bin/env bash
# Starts the real downloader API for integrated e2e tests. Only the platform
# extraction step is simulated (tests/fake_worker.py); queueing, workers,
# temp storage, file delivery and cleanup are the production code.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
svc="$here/../../../services/downloader"
py="${PYTHON:-$svc/.venv/bin/python}"
[ -x "$py" ] || py=python3
work="$(mktemp -d)"
ffmpeg -loglevel error -f lavfi -i testsrc=size=320x240:rate=15 -f lavfi -i sine=frequency=440 -t 2 \
  -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest "$work/sample.mp4"
export YTX_FAKE_MEDIA="$work/sample.mp4" TEMP_ROOT="$work/jobs" MIN_FREE_DISK_MB=1 APP_ENV=test \
  CORS_ORIGINS="http://localhost:4174" WORKER_COMMAND="$py $svc/tests/fake_worker.py" \
  RATE_JOBS_PER_WINDOW=200 RATE_EXTRACT_PER_WINDOW=200 \
  MAX_ACTIVE_JOBS_PER_CLIENT=20
# All e2e tests share ONE client IP, and the desktop and mobile projects run in parallel. With the
# production limit of 2 active downloads per client, a test's job was sometimes refused (429 "You
# already have downloads in progress") because other tests' jobs were still running, e.g. the Cancel
# test's, which only stops in the browser. That was the intermittent ZIP failure. Production keeps 2.
if [ "${LIVE:-0}" = "1" ]; then
  # Real platforms: the production worker (python -m app.worker), production-like limits.
  unset YTX_FAKE_MEDIA WORKER_COMMAND
  export APP_ENV=development MIN_FREE_DISK_MB=200
fi
cd "$svc"
exec "$py" -m uvicorn app.asgi:app --host 127.0.0.1 --port 8788 --log-level warning
