"""Runtime configuration, read once from environment variables.

Every limit has a conservative default sized for a 2 GB / 2 vCPU server.
"""
from __future__ import annotations

import os
import shlex
import sys
from dataclasses import dataclass, field
from pathlib import Path


def _int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    value = int(raw)
    if value < 0:
        raise ValueError(f"{name} must be >= 0")
    return value


def _bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _list(name: str, default: list[str]) -> list[str]:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    return [x.strip() for x in raw.split(",") if x.strip()]


@dataclass(frozen=True)
class Settings:
    env: str = "development"
    temp_root: Path = Path("/tmp/yonixtools-downloader")
    # Concurrency & queueing
    max_concurrent_jobs: int = 2
    max_queued_jobs: int = 20
    max_active_jobs_per_client: int = 2
    max_concurrent_extractions: int = 3
    # Limits
    max_filesize_mb: int = 500
    max_duration_seconds: int = 3 * 60 * 60
    extract_timeout_seconds: int = 45
    job_timeout_seconds: int = 10 * 60
    file_ttl_seconds: int = 15 * 60
    job_ttl_seconds: int = 30 * 60
    min_free_disk_mb: int = 1024
    max_temp_usage_mb: int = 4096
    worker_memory_mb: int = 1536
    max_body_bytes: int = 8 * 1024
    max_items_per_post: int = 20
    # Rate limits: requests per window per client
    rate_window_seconds: int = 60
    rate_extract: int = 20
    rate_jobs: int = 10
    # HTTP
    cors_origins: list[str] = field(default_factory=lambda: ["http://localhost:3000", "http://localhost:4173"])
    trust_proxy_headers: bool = False
    # Worker process command (overridable for tests; never shell-interpreted)
    worker_command: list[str] = field(default_factory=lambda: [sys.executable, "-m", "app.worker"])
    extract_cache_seconds: int = 10 * 60

    @property
    def is_production(self) -> bool:
        return self.env == "production"

    @property
    def max_filesize_bytes(self) -> int:
        return self.max_filesize_mb * 1024 * 1024


def load_settings() -> Settings:
    worker = os.environ.get("WORKER_COMMAND")
    s = Settings(
        env=os.environ.get("APP_ENV", "development"),
        temp_root=Path(os.environ.get("TEMP_ROOT", "/tmp/yonixtools-downloader")),
        max_concurrent_jobs=_int("MAX_CONCURRENT_JOBS", 2),
        max_queued_jobs=_int("MAX_QUEUED_JOBS", 20),
        max_active_jobs_per_client=_int("MAX_ACTIVE_JOBS_PER_CLIENT", 2),
        max_concurrent_extractions=_int("MAX_CONCURRENT_EXTRACTIONS", 3),
        max_filesize_mb=_int("MAX_FILESIZE_MB", 500),
        max_duration_seconds=_int("MAX_DURATION_SECONDS", 3 * 60 * 60),
        extract_timeout_seconds=_int("EXTRACT_TIMEOUT_SECONDS", 45),
        job_timeout_seconds=_int("JOB_TIMEOUT_SECONDS", 600),
        file_ttl_seconds=_int("FILE_TTL_SECONDS", 900),
        job_ttl_seconds=_int("JOB_TTL_SECONDS", 1800),
        min_free_disk_mb=_int("MIN_FREE_DISK_MB", 1024),
        max_temp_usage_mb=_int("MAX_TEMP_USAGE_MB", 4096),
        worker_memory_mb=_int("WORKER_MEMORY_MB", 1536),
        max_body_bytes=_int("MAX_BODY_BYTES", 8192),
        max_items_per_post=_int("MAX_ITEMS_PER_POST", 20),
        rate_window_seconds=_int("RATE_WINDOW_SECONDS", 60),
        rate_extract=_int("RATE_EXTRACT_PER_WINDOW", 20),
        rate_jobs=_int("RATE_JOBS_PER_WINDOW", 10),
        cors_origins=_list("CORS_ORIGINS", ["http://localhost:3000", "http://localhost:4173"]),
        trust_proxy_headers=_bool("TRUST_PROXY_HEADERS", False),
        worker_command=shlex.split(worker) if worker else [sys.executable, "-m", "app.worker"],
        extract_cache_seconds=_int("EXTRACT_CACHE_SECONDS", 600),
    )
    if s.is_production and "*" in s.cors_origins:
        raise ValueError("CORS_ORIGINS must not be '*' in production")
    return s
