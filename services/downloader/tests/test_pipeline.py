"""Real pipeline: app.worker subprocess → yt-dlp → (native HLS) → FFmpeg → file.

Platforms are replaced by a local HTTP server, using yt-dlp's generic
extractor through the worker's test-only backend (refused in production and
without YTX_ALLOW_TEST_BACKEND=1). Everything else is the production code path.
"""
import functools
import http.server
import subprocess
import sys
import threading
from pathlib import Path

import pytest

from app.runner import run_worker

pytestmark = pytest.mark.pipeline
WORKER = [sys.executable, "-m", "app.worker"]
PLATFORM_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"


@pytest.fixture(scope="module")
def media_server(tmp_path_factory):
    root = tmp_path_factory.mktemp("srv")
    subprocess.run(["ffmpeg", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=size=640x360:rate=25", "-f", "lavfi", "-i", "sine=frequency=330",
                    "-t", "3", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", str(root / "clip.mp4")], check=True)
    hls = root / "hls"
    hls.mkdir()
    subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(root / "clip.mp4"), "-c", "copy", "-f", "hls", "-hls_time", "1",
                    "-hls_playlist_type", "vod", str(hls / "index.m3u8")], check=True)
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(root))
    handler.log_message = lambda *a, **k: None
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{srv.server_address[1]}"
    srv.shutdown()


@pytest.fixture(autouse=True)
def allow_test_backend(monkeypatch):
    monkeypatch.setenv("YTX_ALLOW_TEST_BACKEND", "1")
    monkeypatch.setenv("APP_ENV", "test")


def cfg(**kw):
    base = {"max_filesize": 50 * 2**20, "max_duration": 3600, "max_items": 20, "timeout": 30, "memory_mb": 1536,
            "test_backend": "generic", "disable_socket_guard_for_tests": True}
    base.update(kw)
    return base


def ffprobe(path: Path) -> dict:
    import json
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type:format=duration", "-of", "json", str(path)], capture_output=True, check=True)
    return json.loads(out.stdout)


async def test_extract_and_download_direct_mp4(media_server, tmp_path):
    req = {"op": "extract", "url": PLATFORM_URL, "platform": "youtube", "raw_test_url": f"{media_server}/clip.mp4", "config": cfg()}
    ex = await run_worker(WORKER, req, timeout=60)
    assert ex.ok, ex
    info = ex.result["info"]
    assert info["backend"] == "yt-dlp" and info["items"][0]["kind"] == "video"
    fid = info["items"][0]["formats"][0]["id"]
    progress = []
    dl = await run_worker(WORKER, {**req, "op": "download", "backend": "yt-dlp", "item_index": 0, "format_id": fid, "out_dir": str(tmp_path)},
                          timeout=60, on_progress=progress.append)
    assert dl.ok, dl
    out = tmp_path / dl.result["file"]
    assert out.is_file() and dl.result["size"] == out.stat().st_size > 10_000
    types = sorted(s["codec_type"] for s in ffprobe(out)["streams"])
    assert types == ["audio", "video"]
    assert not [p for p in tmp_path.iterdir() if p.suffix == ".part"]


async def test_download_hls_natively(media_server, tmp_path):
    req = {"op": "extract", "url": PLATFORM_URL, "platform": "youtube", "raw_test_url": f"{media_server}/hls/index.m3u8", "config": cfg()}
    ex = await run_worker(WORKER, req, timeout=60)
    assert ex.ok, ex
    fid = ex.result["info"]["items"][0]["formats"][0]["id"]
    dl = await run_worker(WORKER, {**req, "op": "download", "backend": "yt-dlp", "item_index": 0, "format_id": fid, "out_dir": str(tmp_path)}, timeout=90)
    assert dl.ok, dl
    out = tmp_path / dl.result["file"]
    assert float(ffprobe(out)["format"]["duration"]) == pytest.approx(3, abs=0.6)


async def test_size_limit_is_enforced(media_server, tmp_path):
    req = {"op": "download", "url": PLATFORM_URL, "platform": "youtube", "raw_test_url": f"{media_server}/clip.mp4", "backend": "yt-dlp",
           "item_index": 0, "format_id": "f:best", "out_dir": str(tmp_path), "config": cfg(max_filesize=20_000)}
    dl = await run_worker(WORKER, req, timeout=60)
    assert not dl.ok and dl.code == "too_large", dl
    assert not [p for p in tmp_path.iterdir() if p.name.startswith("media.") and not p.name.endswith(".part")]


async def test_socket_guard_blocks_local_targets_even_in_worker(media_server, tmp_path):
    req = {"op": "extract", "url": PLATFORM_URL, "platform": "youtube", "raw_test_url": f"{media_server}/clip.mp4",
           "config": cfg(disable_socket_guard_for_tests=False)}
    ex = await run_worker(WORKER, req, timeout=60)
    assert not ex.ok and ex.code == "unsafe_url", ex


async def test_test_backend_refused_in_production(media_server, monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    req = {"op": "extract", "url": PLATFORM_URL, "platform": "youtube", "raw_test_url": f"{media_server}/clip.mp4", "config": cfg()}
    ex = await run_worker(WORKER, req, timeout=60)
    # Falls back to the real YouTube extractor on the real URL; it must never touch the local server.
    assert ex.result is None or ex.result.get("info", {}).get("backend") == "yt-dlp"
    assert not ex.ok or "127.0.0.1" not in str(ex.result)


async def test_real_worker_runs_from_job_directory(media_server, tmp_path, monkeypatch):
    """Regression: the API runs download workers with cwd = job dir (as in the container)."""
    monkeypatch.delenv("PYTHONPATH", raising=False)
    job_dir = tmp_path / "job"
    job_dir.mkdir()
    req = {"op": "download", "url": PLATFORM_URL, "platform": "youtube", "raw_test_url": f"{media_server}/clip.mp4", "backend": "yt-dlp",
           "item_index": 0, "format_id": "f:best", "out_dir": str(job_dir), "config": cfg()}
    r = await run_worker(WORKER, req, timeout=60, cwd=str(job_dir))
    assert r.ok, r
    assert (job_dir / r.result["file"]).stat().st_size > 10_000


async def test_worker_rejects_tampered_requests(tmp_path):
    bad = [
        {"op": "extract", "url": "http://127.0.0.1/", "platform": "youtube", "config": cfg()},
        {"op": "extract", "url": PLATFORM_URL, "platform": "instagram", "config": cfg()},
        {"op": "download", "url": PLATFORM_URL, "platform": "youtube", "backend": "yt-dlp", "format_id": "bv*;rm -rf /", "out_dir": str(tmp_path), "config": cfg()},
    ]
    for req in bad:
        r = await run_worker(WORKER, req, timeout=30)
        assert not r.ok and r.code in ("unsafe_url", "invalid_request", "invalid_format"), r


def test_worker_dies_with_its_parent(tmp_path):
    """If the API process is killed, the worker (and its process group) must not linger."""
    import os
    import signal
    import socket as pysocket
    import time

    hang = pysocket.socket()
    hang.bind(("127.0.0.1", 0))
    hang.listen(5)  # accepts TCP but never answers HTTP → yt-dlp blocks
    port = hang.getsockname()[1]
    req = {"op": "extract", "url": PLATFORM_URL, "platform": "youtube", "raw_test_url": f"http://127.0.0.1:{port}/x.mp4", "config": cfg(timeout=120)}
    parent_code = (
        "import json, subprocess, sys, time\n"
        f"p = subprocess.Popen({WORKER!r}, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, start_new_session=True)\n"
        f"p.stdin.write(json.dumps({req!r}).encode()); p.stdin.close()\n"
        "print(p.pid, flush=True); time.sleep(120)\n"
    )
    parent = subprocess.Popen([sys.executable, "-c", parent_code], stdout=subprocess.PIPE, env={**os.environ})
    worker_pid = int(parent.stdout.readline())
    time.sleep(1.5)
    os.kill(worker_pid, 0)  # alive while the parent lives
    parent.send_signal(signal.SIGKILL)
    parent.wait()
    for _ in range(40):
        try:
            os.kill(worker_pid, 0)
        except ProcessLookupError:
            break
        time.sleep(0.1)
    else:
        os.kill(worker_pid, signal.SIGKILL)
        raise AssertionError("worker outlived its parent")
    hang.close()


async def test_worker_deadline_kills_hung_operations(tmp_path):
    import socket as pysocket
    import time
    hang = pysocket.socket()
    hang.bind(("127.0.0.1", 0))
    hang.listen(5)
    req = {"op": "extract", "url": PLATFORM_URL, "platform": "youtube", "raw_test_url": f"http://127.0.0.1:{hang.getsockname()[1]}/x.mp4",
           "config": cfg(deadline_seconds=2)}
    t0 = time.monotonic()
    r = await run_worker(WORKER, req, timeout=30)
    assert not r.ok and time.monotonic() - t0 < 8
    hang.close()
