"""Isolated worker process: one extraction or one download per process.

The API never runs extractors in-process. Each operation runs here with:
  * the outbound socket guard installed (public IPs only),
  * memory, file-size, CPU and file-descriptor limits,
  * its own process group, so the parent can kill it (and FFmpeg) on timeout.

Protocol: one JSON request on stdin; JSON lines on stdout:
  {"type": "progress", "percent": 12.5, "downloaded": 123, "total": 456}
  {"type": "result", ...}   or   {"type": "error", "code": ..., "backend": ..., "detail": ...}
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path


def _emit(obj: dict) -> None:
    sys.stdout.write(json.dumps(obj, separators=(",", ":")) + "\n")
    sys.stdout.flush()


def _limits(cfg: dict) -> None:
    try:
        import resource
    except ImportError:  # pragma: no cover - non-POSIX
        return
    mem = int(cfg.get("memory_mb", 1536)) * 1024 * 1024
    fsize = int(cfg["max_filesize"] * 1.05) + 32 * 1024 * 1024
    for res, val in ((resource.RLIMIT_AS, mem), (resource.RLIMIT_FSIZE, fsize), (resource.RLIMIT_CORE, 0), (resource.RLIMIT_NOFILE, 512)):
        try:
            resource.setrlimit(res, (val, val))
        except (ValueError, OSError):
            pass
    cpu = int(cfg.get("cpu_seconds", 0))
    if cpu:
        try:
            resource.setrlimit(resource.RLIMIT_CPU, (cpu, cpu + 5))
        except (ValueError, OSError):
            pass


def _start_watchdog(deadline_seconds: float) -> None:
    """Kill this worker's whole process group (incl. FFmpeg) if the API dies or the deadline passes.

    The worker runs in its own session, so it would otherwise outlive a crashed parent.
    """
    import os
    import signal
    import threading

    parent = os.getppid()
    start = time.monotonic()
    try:  # Linux: also ask the kernel to SIGKILL us when the parent exits.
        import ctypes

        ctypes.CDLL("libc.so.6", use_errno=True).prctl(1, signal.SIGKILL)  # PR_SET_PDEATHSIG
    except (OSError, AttributeError):
        pass

    def watch() -> None:
        while True:
            time.sleep(0.5)
            if os.getppid() != parent or (deadline_seconds and time.monotonic() - start > deadline_seconds):
                try:
                    os.killpg(os.getpgrp(), signal.SIGKILL)
                finally:
                    os._exit(137)

    threading.Thread(target=watch, daemon=True, name="watchdog").start()


def main() -> int:
    raw = sys.stdin.read(65536)
    try:
        req = json.loads(raw)
    except json.JSONDecodeError:
        _emit({"type": "error", "code": "server_error", "backend": "worker", "detail": "bad request json"})
        return 2

    from .media import FORMAT_ID_RE
    from .netguard import install_socket_guard
    from .platforms import PLATFORMS, parse_media_url

    cfg = req.get("config") or {}
    _start_watchdog(float(cfg.get("deadline_seconds") or 0))
    _limits(cfg)
    if not cfg.get("disable_socket_guard_for_tests"):
        install_socket_guard()

    # Defence in depth: re-validate everything the parent sent.
    from .adapters.chain import ExtractionFailed, download, extract
    from .errors import ApiError

    try:
        parsed = parse_media_url(req["url"])
    except (ApiError, KeyError) as e:
        _emit({"type": "error", "code": getattr(e, "code", "invalid_request"), "backend": "worker", "detail": "url rejected"})
        return 2
    platform = PLATFORMS.get(req.get("platform", ""))
    if platform is None or platform.id != parsed.platform.id:
        _emit({"type": "error", "code": "invalid_request", "backend": "worker", "detail": "platform mismatch"})
        return 2

    chain = None
    import os

    if (cfg.get("test_backend") == "generic" and req.get("raw_test_url") and os.environ.get("YTX_ALLOW_TEST_BACKEND") == "1"
            and os.environ.get("APP_ENV") != "production"):
        # Used only by the local pipeline test (never set by the API, refused in production).
        from .adapters.ytdlp_backend import YtDlpBackend
        chain = [YtDlpBackend(("generic",), cfg["max_filesize"], cfg["max_duration"], cfg["max_items"])]
        url = req["raw_test_url"]
    else:
        url = parsed.url

    op = req.get("op")
    try:
        if op == "extract":
            info = extract(platform, url, cfg, chain)
            _emit({"type": "result", "info": info.to_dict()})
            return 0
        if op == "download":
            fmt = str(req.get("format_id", ""))
            if not FORMAT_ID_RE.match(fmt):
                _emit({"type": "error", "code": "invalid_format", "backend": "worker", "detail": "format id"})
                return 2
            out_dir = Path(req["out_dir"]).resolve()
            last = [0.0]

            def progress(pct, done, total):
                now = time.monotonic()
                if now - last[0] >= 0.4:
                    last[0] = now
                    _emit({"type": "progress", "percent": None if pct is None else round(min(pct, 100.0), 1), "downloaded": done, "total": total})

            path = download(platform, url, req["backend"], int(req.get("item_index", 0)), fmt, out_dir, bool(req.get("multi")), cfg, progress, chain)
            if path.resolve().parent != out_dir:
                _emit({"type": "error", "code": "server_error", "backend": "worker", "detail": "output escaped job dir"})
                return 2
            _emit({"type": "result", "file": path.name, "size": path.stat().st_size})
            return 0
        _emit({"type": "error", "code": "invalid_request", "backend": "worker", "detail": "unknown op"})
        return 2
    except ExtractionFailed as e:
        _emit({"type": "error", "code": e.code, "backend": e.backend, "detail": e.detail})
        return 1
    except MemoryError:
        _emit({"type": "error", "code": "too_large", "backend": "worker", "detail": "memory limit"})
        return 1
    except Exception as e:  # pragma: no cover - last resort, details stay in logs
        _emit({"type": "error", "code": "server_error", "backend": "worker", "detail": f"{type(e).__name__}: {e}"[:500]})
        return 1


if __name__ == "__main__":
    sys.exit(main())
