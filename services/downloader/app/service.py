"""Downloader service: extraction, job queue, temp storage, cleanup and stats."""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import re
import secrets
import shutil
import time
from collections import Counter, OrderedDict
from dataclasses import dataclass, field
from pathlib import Path

from .config import Settings
from .errors import DEFAULT_MESSAGES, ApiError
from .media import FORMAT_ID_RE, MediaInfo
from .platforms import ParsedUrl, parse_media_url
from .resolver import resolve_short_link
from .runner import run_worker

log = logging.getLogger("downloader")
JOB_ID_RE = re.compile(r"^[A-Za-z0-9_-]{20,40}$")
SAFE_FILE_RE = re.compile(r"^media\.[A-Za-z0-9]{1,8}$")


def url_ref(url: str) -> str:
    """Log-safe reference to a URL: host + short hash (no path, no query)."""
    host = url.split("/")[2] if url.count("/") >= 2 else "?"
    return f"{host}#{hashlib.sha256(url.encode()).hexdigest()[:12]}"


def event(name: str, **fields: object) -> None:
    log.info(json.dumps({"event": name, **fields}, default=str, separators=(",", ":")))


@dataclass
class Job:
    id: str
    client: str
    platform: str
    url: str
    backend: str
    item_index: int
    format_id: str
    multi: bool
    dir: Path
    created: float = field(default_factory=time.time)
    status: str = "queued"  # queued | running | done | failed | expired
    progress: float | None = None
    downloaded: int | None = None
    total: int | None = None
    error_code: str | None = None
    file_name: str | None = None
    file_size: int | None = None
    expires_at: float | None = None
    task: asyncio.Task | None = None

    def public(self) -> dict:
        out: dict = {"id": self.id, "status": self.status, "platform": self.platform}
        if self.progress is not None:
            out["progress"] = self.progress
        if self.status == "done" and self.file_name:
            out["downloadUrl"] = f"/v1/jobs/{self.id}/file"
            out["filesize"] = self.file_size
            out["expiresAt"] = int(self.expires_at or 0)
        if self.status in ("failed", "expired"):
            code = self.error_code or ("expired" if self.status == "expired" else "server_error")
            out["error"] = {"code": code, "message": DEFAULT_MESSAGES.get(code, DEFAULT_MESSAGES["server_error"])}
        return out


class DownloaderService:
    def __init__(self, settings: Settings):
        self.s = settings
        self.jobs: dict[str, Job] = {}
        self.cache: OrderedDict[str, tuple[float, MediaInfo]] = OrderedDict()
        self.stats: Counter[str] = Counter()
        self._job_sem = asyncio.Semaphore(max(1, settings.max_concurrent_jobs))
        self._extract_sem = asyncio.Semaphore(max(1, settings.max_concurrent_extractions))
        self._extract_waiting = 0
        self._cleanup_task: asyncio.Task | None = None
        self.started = time.time()

    # ── lifecycle ──────────────────────────────────────────────────────────
    async def start(self) -> None:
        root = self.s.temp_root
        root.mkdir(parents=True, exist_ok=True)
        os.chmod(root, 0o700)
        # Jobs live in memory only, so anything on disk after a restart is orphaned.
        removed = 0
        for child in root.iterdir():
            shutil.rmtree(child, ignore_errors=True) if child.is_dir() else child.unlink(missing_ok=True)
            removed += 1
        event("startup", purged=removed, temp_root=str(root))
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())

    async def stop(self) -> None:
        if self._cleanup_task:
            self._cleanup_task.cancel()
        tasks = [j.task for j in self.jobs.values() if j.task and not j.task.done()]
        for t in tasks:
            t.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        for j in list(self.jobs.values()):
            shutil.rmtree(j.dir, ignore_errors=True)

    # ── extraction ─────────────────────────────────────────────────────────
    def _worker_config(self) -> dict:
        return {
            "max_filesize": self.s.max_filesize_bytes,
            "max_duration": self.s.max_duration_seconds,
            "max_items": self.s.max_items_per_post,
            "timeout": self.s.extract_timeout_seconds,
            "memory_mb": self.s.worker_memory_mb,
            "cpu_seconds": self.s.job_timeout_seconds + 60,
            # Worker self-destructs shortly after the API-side timeout, even if the API is gone.
            "deadline_seconds": max(self.s.job_timeout_seconds, self.s.extract_timeout_seconds) + 30,
        }

    async def parse(self, raw_url: object) -> ParsedUrl:
        parsed = parse_media_url(raw_url)
        return await resolve_short_link(parsed)

    def _cache_get(self, key: str) -> MediaInfo | None:
        hit = self.cache.get(key)
        if not hit:
            return None
        if hit[0] < time.time():
            self.cache.pop(key, None)
            return None
        self.cache.move_to_end(key)
        return hit[1]

    def _cache_put(self, key: str, info: MediaInfo) -> None:
        self.cache[key] = (time.time() + self.s.extract_cache_seconds, info)
        self.cache.move_to_end(key)
        while len(self.cache) > 512:
            self.cache.popitem(last=False)

    async def extract(self, raw_url: object) -> tuple[ParsedUrl, MediaInfo]:
        parsed = await self.parse(raw_url)
        pid = parsed.platform.id
        cached = self._cache_get(parsed.url)
        if cached:
            self.stats[f"extract.{pid}.cache_hit"] += 1
            return parsed, cached
        if self._extract_waiting >= self.s.max_concurrent_extractions * 4:
            raise ApiError("busy", platform=pid)
        self._extract_waiting += 1
        try:
            try:
                await asyncio.wait_for(self._extract_sem.acquire(), timeout=15)
            except asyncio.TimeoutError:
                raise ApiError("busy", platform=pid) from None
        finally:
            self._extract_waiting -= 1
        t0 = time.monotonic()
        try:
            outcome = await run_worker(self.s.worker_command, {"op": "extract", "url": parsed.url, "platform": pid, "config": self._worker_config()},
                                       timeout=self.s.extract_timeout_seconds + 5)
        finally:
            self._extract_sem.release()
        ms = int((time.monotonic() - t0) * 1000)
        if not outcome.ok:
            self.stats[f"extract.{pid}.{outcome.backend}.fail.{outcome.code}"] += 1
            event("extract_failed", platform=pid, backend=outcome.backend, code=outcome.code, ms=ms, url=url_ref(parsed.url), detail=outcome.detail[:300])
            raise ApiError(outcome.code if outcome.code in DEFAULT_MESSAGES else "extractor_failed", platform=pid)
        try:
            info = MediaInfo.from_dict(outcome.result["info"])  # type: ignore[index]
        except (KeyError, TypeError, ValueError):
            self.stats[f"extract.{pid}.worker.fail.invalid_result"] += 1
            raise ApiError("extractor_failed", platform=pid) from None
        if not info.items or not all(i.formats for i in info.items):
            raise ApiError("no_media", platform=pid)
        self.stats[f"extract.{pid}.{info.backend}.ok"] += 1
        event("extract_ok", platform=pid, backend=info.backend, items=len(info.items), ms=ms, url=url_ref(parsed.url))
        self._cache_put(parsed.url, info)
        return parsed, info

    # ── jobs ───────────────────────────────────────────────────────────────
    def _active(self, client: str | None = None) -> int:
        return sum(1 for j in self.jobs.values() if j.status in ("queued", "running") and (client is None or j.client == client))

    def _temp_usage_bytes(self) -> int:
        total = 0
        for dirpath, _, files in os.walk(self.s.temp_root):
            for f in files:
                try:
                    total += os.lstat(os.path.join(dirpath, f)).st_size
                except OSError:
                    pass
        return total

    def _check_storage(self, platform: str) -> None:
        free_mb = shutil.disk_usage(self.s.temp_root).free / (1024 * 1024)
        if free_mb < self.s.min_free_disk_mb or self._temp_usage_bytes() / (1024 * 1024) > self.s.max_temp_usage_mb:
            self.stats["jobs.rejected.storage"] += 1
            raise ApiError("busy", platform=platform)

    async def create_job(self, raw_url: object, item_index: object, format_id: object, client: str) -> Job:
        if not isinstance(format_id, str) or not FORMAT_ID_RE.match(format_id):
            raise ApiError("invalid_format")
        if not isinstance(item_index, int) or isinstance(item_index, bool) or not 0 <= item_index < self.s.max_items_per_post:
            raise ApiError("invalid_request", "Invalid item.")
        parsed, info = await self.extract(raw_url)
        pid = parsed.platform.id
        item = next((i for i in info.items if i.index == item_index), None)
        if item is None or not any(f.id == format_id for f in item.formats):
            raise ApiError("invalid_format", platform=pid)
        fmt = next(f for f in item.formats if f.id == format_id)
        if fmt.filesize and fmt.filesize > self.s.max_filesize_bytes:
            raise ApiError("too_large", platform=pid)
        if self._active(client) >= self.s.max_active_jobs_per_client:
            raise ApiError("rate_limited", "You already have downloads in progress. Wait for them to finish.", pid)
        if self._active() >= self.s.max_queued_jobs:
            self.stats["jobs.rejected.busy"] += 1
            raise ApiError("busy", platform=pid)
        self._check_storage(pid)
        job_id = secrets.token_urlsafe(18)
        job_dir = self.s.temp_root / job_id
        job_dir.mkdir(mode=0o700)
        job = Job(id=job_id, client=client, platform=pid, url=parsed.url, backend=info.backend, item_index=item_index, format_id=format_id,
                  multi=bool(info.extra.get("multi")), dir=job_dir)
        self.jobs[job_id] = job
        job.task = asyncio.create_task(self._run(job))
        self.stats[f"jobs.{pid}.created"] += 1
        event("job_created", job=job_id, platform=pid, backend=info.backend, format=format_id)
        return job

    async def _run(self, job: Job) -> None:
        t0 = time.monotonic()
        try:
            async with self._job_sem:
                if job.status != "queued":
                    return
                job.status = "running"

                def on_progress(msg: dict) -> None:
                    job.progress = msg.get("percent")
                    job.downloaded = msg.get("downloaded")
                    job.total = msg.get("total")

                outcome = await run_worker(
                    self.s.worker_command,
                    {"op": "download", "url": job.url, "platform": job.platform, "backend": job.backend, "item_index": job.item_index,
                     "format_id": job.format_id, "multi": job.multi, "out_dir": str(job.dir), "config": self._worker_config()},
                    timeout=self.s.job_timeout_seconds, cwd=str(job.dir), on_progress=on_progress)
            ms = int((time.monotonic() - t0) * 1000)
            if outcome.ok and outcome.result:
                name = str(outcome.result.get("file", ""))
                path = (job.dir / name).resolve()
                if not SAFE_FILE_RE.match(name) or path.parent != job.dir.resolve() or not path.is_file():
                    raise ApiError("server_error")
                size = path.stat().st_size
                if size == 0:
                    raise ApiError("extractor_failed")
                if size > self.s.max_filesize_bytes:
                    raise ApiError("too_large")
                job.file_name, job.file_size = name, size
                job.status, job.progress = "done", 100.0
                job.expires_at = time.time() + self.s.file_ttl_seconds
                self.stats[f"jobs.{job.platform}.{job.backend}.ok"] += 1
                event("job_done", job=job.id, platform=job.platform, backend=job.backend, bytes=size, ms=ms)
            else:
                job.status, job.error_code = "failed", outcome.code if outcome.code in DEFAULT_MESSAGES else "extractor_failed"
                self.stats[f"jobs.{job.platform}.{outcome.backend}.fail.{job.error_code}"] += 1
                event("job_failed", job=job.id, platform=job.platform, backend=outcome.backend, code=job.error_code, ms=ms, detail=outcome.detail[:300])
                shutil.rmtree(job.dir, ignore_errors=True)
        except ApiError as e:
            job.status, job.error_code = "failed", e.code
            self.stats[f"jobs.{job.platform}.worker.fail.{e.code}"] += 1
            event("job_failed", job=job.id, platform=job.platform, code=e.code)
            shutil.rmtree(job.dir, ignore_errors=True)
        except asyncio.CancelledError:
            job.status, job.error_code = "failed", "server_error"
            shutil.rmtree(job.dir, ignore_errors=True)
            raise
        except Exception:  # pragma: no cover
            log.exception("job crashed")
            job.status, job.error_code = "failed", "server_error"
            shutil.rmtree(job.dir, ignore_errors=True)

    def get_job(self, job_id: str) -> Job:
        if not JOB_ID_RE.match(job_id or ""):
            raise ApiError("not_found")
        job = self.jobs.get(job_id)
        if not job:
            raise ApiError("not_found")
        self._expire_if_due(job)
        return job

    def file_for(self, job_id: str) -> tuple[Job, Path]:
        job = self.get_job(job_id)
        if job.status == "expired":
            raise ApiError("expired", platform=job.platform)
        if job.status != "done" or not job.file_name:
            raise ApiError("not_found")
        path = (job.dir / job.file_name).resolve()
        if path.parent != job.dir.resolve() or not path.is_file():
            job.status, job.error_code = "expired", "expired"
            raise ApiError("expired", platform=job.platform)
        return job, path

    def _expire_if_due(self, job: Job, now: float | None = None) -> None:
        now = now or time.time()
        if job.status == "done" and job.expires_at and now >= job.expires_at:
            shutil.rmtree(job.dir, ignore_errors=True)
            job.status, job.error_code, job.file_name = "expired", "expired", None
            self.stats["jobs.expired"] += 1

    def cleanup(self, now: float | None = None) -> int:
        """Delete expired files, forget old jobs, remove orphaned dirs. Returns removed dir count."""
        now = now or time.time()
        removed = 0
        for job in list(self.jobs.values()):
            self._expire_if_due(job, now)
            if job.status not in ("queued", "running") and now - job.created > self.s.job_ttl_seconds:
                shutil.rmtree(job.dir, ignore_errors=True)
                del self.jobs[job.id]
        known = {j.dir.name for j in self.jobs.values() if j.status in ("queued", "running", "done")}
        try:
            for child in self.s.temp_root.iterdir():
                if child.name not in known:
                    try:
                        age = now - child.stat().st_mtime
                    except FileNotFoundError:
                        continue
                    if age > 60:
                        shutil.rmtree(child, ignore_errors=True) if child.is_dir() else child.unlink(missing_ok=True)
                        removed += 1
        except FileNotFoundError:
            self.s.temp_root.mkdir(parents=True, exist_ok=True)
        return removed

    async def _cleanup_loop(self) -> None:
        while True:
            await asyncio.sleep(30)
            try:
                n = self.cleanup()
                if n:
                    event("cleanup", removed=n)
            except Exception:  # pragma: no cover
                log.exception("cleanup failed")

    def snapshot(self) -> dict:
        return {
            "uptimeSeconds": int(time.time() - self.started),
            "jobs": {"active": self._active(), "tracked": len(self.jobs)},
            "tempUsageMb": round(self._temp_usage_bytes() / (1024 * 1024), 1),
            "counters": dict(sorted(self.stats.items())),
        }
