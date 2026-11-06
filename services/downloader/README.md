# YoniXTools downloader service

FastAPI service that extracts and downloads **public** media from supported platforms using
self-hosted open-source extractors (yt-dlp, with gallery-dl as a fallback for image posts, and FFmpeg for merging).
No paid APIs, cookies, logins, DRM circumvention or private-content access.

See `../../docs/ARCHITECTURE.md` and `../../docs/DOWNLOADER_API.md`.

```bash
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env            # adjust; for local dev set APP_ENV=development, TEMP_ROOT=/tmp/ytx
uvicorn app.asgi:app --port 8787
pytest                           # unit + security + integration + real yt-dlp/FFmpeg pipeline + load
RUN_LIVE_TESTS=1 LIVE_URL_INSTAGRAM_REEL=https://… pytest tests/test_live.py   # real platforms
pip-audit -r requirements.txt
```

Requires `ffmpeg`/`ffprobe` on PATH. Keep yt-dlp up to date: platforms change frequently.
