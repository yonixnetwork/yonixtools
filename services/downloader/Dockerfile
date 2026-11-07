# syntax=docker/dockerfile:1
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --system --uid 10001 --home /app --shell /usr/sbin/nologin app
# Deno: the JavaScript runtime yt-dlp needs to solve YouTube's player challenges
# (without it YouTube returns no usable formats). Single static binary.
COPY --from=denoland/deno:bin-2.5.6 /deno /usr/local/bin/deno
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt && deno --version | head -1
COPY app ./app
COPY diagnostics ./diagnostics
RUN mkdir -p /var/lib/yonixtools/tmp && chown -R app:app /var/lib/yonixtools
USER app
ENV APP_ENV=production TEMP_ROOT=/var/lib/yonixtools/tmp HOME=/tmp
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8787/healthz', timeout=3).status == 200 else 1)"
# One process only: job state lives in memory (see docs/ARCHITECTURE.md).
CMD ["uvicorn", "app.asgi:app", "--host", "0.0.0.0", "--port", "8787", "--workers", "1", "--no-server-header"]
