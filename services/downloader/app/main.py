"""HTTP API for the YoniXTools downloader."""
from __future__ import annotations

import json
import logging
import shutil
import sys
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import Settings, load_settings
from .errors import ApiError
from .netguard import install_socket_guard
from .ratelimit import RateLimiter
from .service import DownloaderService

MEDIA_TYPES = {"mp4": "video/mp4", "webm": "video/webm", "mkv": "video/x-matroska", "mov": "video/quicktime", "m4a": "audio/mp4", "mp3": "audio/mpeg",
               "opus": "audio/ogg", "ogg": "audio/ogg", "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp", "gif": "image/gif"}


def _setup_logging() -> None:
    root = logging.getLogger()
    if not root.handlers:
        h = logging.StreamHandler(sys.stdout)
        h.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
        root.addHandler(h)
    root.setLevel(logging.INFO)
    logging.getLogger("httpx").setLevel(logging.WARNING)


def client_key(request: Request, settings: Settings) -> str:
    if settings.trust_proxy_headers:
        real = request.headers.get("x-real-ip", "").strip()
        if real and len(real) <= 45:
            return real
    return request.client.host if request.client else "unknown"


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or load_settings()
    _setup_logging()
    install_socket_guard()  # API process: short-link resolution only reaches public IPs
    service = DownloaderService(settings)
    extract_rl = RateLimiter(settings.rate_extract, settings.rate_window_seconds)
    jobs_rl = RateLimiter(settings.rate_jobs, settings.rate_window_seconds)
    poll_rl = RateLimiter(240, settings.rate_window_seconds)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        await service.start()
        yield
        await service.stop()

    app = FastAPI(title="YoniXTools Downloader", docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
    app.state.service = service
    app.state.settings = settings

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST"],
        allow_headers=["content-type"],
        max_age=600,
    )

    @app.middleware("http")
    async def guard(request: Request, call_next):
        t0 = time.monotonic()
        if request.method == "POST":
            cl = request.headers.get("content-length")
            if cl is not None and (not cl.isdigit() or int(cl) > settings.max_body_bytes):
                return _error(ApiError("payload_too_large"))
            if "application/json" not in request.headers.get("content-type", ""):
                return _error(ApiError("invalid_request", "Send JSON."))
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers.setdefault("Cache-Control", "no-store")
        response.headers["Cross-Origin-Resource-Policy"] = "same-site"
        if request.url.path not in ("/healthz",):
            logging.getLogger("access").info(json.dumps({"m": request.method, "p": request.url.path if not request.url.path.startswith("/v1/jobs/") else "/v1/jobs/:id" + ("/file" if request.url.path.endswith("/file") else ""),
                                                         "s": response.status_code, "ms": int((time.monotonic() - t0) * 1000)}))
        return response

    @app.exception_handler(ApiError)
    async def api_error(_: Request, e: ApiError):
        return _error(e)

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, e: RequestValidationError):
        return _error(ApiError("invalid_request"))

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_: Request, e: StarletteHTTPException):
        if e.status_code == 405:
            return JSONResponse({"error": {"code": "invalid_request", "message": "Method not allowed."}}, status_code=405)
        return _error(ApiError("not_found"))

    @app.exception_handler(Exception)
    async def unhandled(_: Request, e: Exception):
        logging.getLogger("downloader").exception("unhandled error")
        return _error(ApiError("server_error"))

    async def json_body(request: Request) -> dict:
        body = await request.body()
        if len(body) > settings.max_body_bytes:
            raise ApiError("payload_too_large")
        try:
            data = json.loads(body or b"{}")
        except (json.JSONDecodeError, UnicodeDecodeError):
            raise ApiError("invalid_request", "Send valid JSON.") from None
        if not isinstance(data, dict):
            raise ApiError("invalid_request")
        return data

    def limit(rl: RateLimiter, request: Request) -> None:
        ok, retry = rl.hit(client_key(request, settings))
        if not ok:
            raise ApiError("rate_limited", status=429)

    @app.get("/healthz")
    async def healthz():
        return {"status": "ok"}

    @app.get("/readyz")
    async def readyz():
        checks = {
            "tempWritable": settings.temp_root.is_dir() and shutil.disk_usage(settings.temp_root).free > settings.min_free_disk_mb * 1024 * 1024,
            "ffmpeg": shutil.which("ffmpeg") is not None,
        }
        try:
            import yt_dlp  # noqa: F401
            checks["extractor"] = True
        except ImportError:
            checks["extractor"] = False
        ok = all(checks.values())
        return JSONResponse({"status": "ok" if ok else "degraded", "checks": checks}, status_code=200 if ok else 503)

    @app.post("/v1/extract")
    async def extract(request: Request):
        limit(extract_rl, request)
        data = await json_body(request)
        _, info = await service.extract(data.get("url"))
        return info.public()

    @app.post("/v1/jobs")
    async def create_job(request: Request):
        limit(jobs_rl, request)
        data = await json_body(request)
        job = await service.create_job(data.get("url"), data.get("itemIndex", 0), data.get("formatId"), client_key(request, settings))
        return JSONResponse(job.public(), status_code=202)

    @app.get("/v1/jobs/{job_id}")
    async def get_job(job_id: str, request: Request):
        limit(poll_rl, request)
        return service.get_job(job_id).public()

    @app.get("/v1/jobs/{job_id}/file")
    async def get_file(job_id: str, request: Request):
        limit(poll_rl, request)
        job, path = service.file_for(job_id)
        ext = path.suffix.lstrip(".").lower()
        name = f"yonixtools-{job.platform}-{job.id[:8]}.{ext}"
        return FileResponse(path, media_type=MEDIA_TYPES.get(ext, "application/octet-stream"), filename=name,
                            headers={"Cache-Control": "no-store", "Content-Security-Policy": "sandbox; default-src 'none'"})

    @app.get("/internal/stats")
    async def stats(request: Request):
        # Only from the host itself, never through the reverse proxy.
        if (request.client and request.client.host not in ("127.0.0.1", "::1")) or request.headers.get("x-real-ip") or request.headers.get("x-forwarded-for"):
            raise ApiError("not_found")
        return service.snapshot()

    return app


def _error(e: ApiError) -> JSONResponse:
    headers = {"Retry-After": "60"} if e.code in ("rate_limited", "busy") else None
    return JSONResponse(e.body(), status_code=e.status, headers=headers)
