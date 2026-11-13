import dataclasses
import shutil
import subprocess
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.netguard import uninstall_socket_guard

HERE = Path(__file__).parent


@pytest.fixture(scope="session")
def sample_mp4(tmp_path_factory) -> Path:
    """A real 2-second H.264/AAC MP4 made with FFmpeg."""
    out = tmp_path_factory.mktemp("media") / "sample.mp4"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=size=320x240:rate=15", "-f", "lavfi", "-i", "sine=frequency=440",
                    "-t", "2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", str(out)], check=True)
    return out


@pytest.fixture
def settings(tmp_path) -> Settings:
    return Settings(env="test", temp_root=tmp_path / "jobs", worker_command=[sys.executable, str(HERE / "fake_worker.py")],
                    min_free_disk_mb=1, max_temp_usage_mb=500, rate_extract=1000, rate_jobs=1000, job_timeout_seconds=20, extract_timeout_seconds=10)


@pytest.fixture
def make_client(monkeypatch, sample_mp4):
    monkeypatch.setenv("YTX_FAKE_MEDIA", str(sample_mp4))
    clients = []

    def _make(s: Settings, **overrides) -> TestClient:
        from app.main import create_app

        app = create_app(dataclasses.replace(s, **overrides) if overrides else s)
        c = TestClient(app)
        c.__enter__()
        clients.append(c)
        return c

    yield _make
    for c in clients:
        c.__exit__(None, None, None)
    uninstall_socket_guard()


@pytest.fixture
def client(make_client, settings):
    return make_client(settings)


@pytest.fixture(autouse=True)
def _no_real_dns_for_short_links(monkeypatch):
    """Short-link resolution must never hit the network in unit tests."""
    import app.resolver as r

    async def fake(parsed, client=None, timeout=8.0):
        return parsed
    monkeypatch.setattr(r, "resolve_short_link", fake)
    import app.service as s
    monkeypatch.setattr(s, "resolve_short_link", fake)
    yield


def wait_job(client, job_id, timeout=15):
    import time
    end = time.time() + timeout
    while time.time() < end:
        j = client.get(f"/v1/jobs/{job_id}").json()
        if j["status"] in ("done", "failed", "expired"):
            return j
        time.sleep(0.1)
    raise AssertionError("job did not finish")


@pytest.fixture
def ffprobe_ok():
    def check(path: Path) -> dict:
        out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,codec_name", "-of", "json", str(path)], capture_output=True, check=True)
        import json
        return json.loads(out.stdout)
    assert shutil.which("ffprobe")
    return check
