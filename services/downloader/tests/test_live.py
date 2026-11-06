"""Live checks against real public posts. Opt-in: RUN_LIVE_TESTS=1.

URLs can be overridden with LIVE_URL_<PLATFORM> (e.g. LIVE_URL_INSTAGRAM_REEL).
These go through the production worker (platform extractors only, socket guard on).
Results are appended to live-results.json for the release report.
"""
import json
import os
import sys
import time
from pathlib import Path

import pytest

from app.runner import run_worker

pytestmark = [pytest.mark.live, pytest.mark.skipif(os.environ.get("RUN_LIVE_TESTS") != "1", reason="set RUN_LIVE_TESTS=1")]
WORKER = [sys.executable, "-m", "app.worker"]
CFG = {"max_filesize": 200 * 2**20, "max_duration": 3600, "max_items": 20, "timeout": 60, "memory_mb": 1536}
REPORT = Path(__file__).parent.parent / "live-results.json"

# Long-lived public samples. Ones without a default must be supplied via env.
SAMPLES = {
    "youtube_video": ("youtube", "https://www.youtube.com/watch?v=jNQXAC9IVRw"),
    "youtube_short": ("youtube", os.environ.get("LIVE_URL_YOUTUBE_SHORT", "")),
    "vimeo_video": ("vimeo", "https://vimeo.com/76979871"),
    "instagram_reel": ("instagram", os.environ.get("LIVE_URL_INSTAGRAM_REEL", "")),
    "instagram_video": ("instagram", os.environ.get("LIVE_URL_INSTAGRAM_VIDEO", "")),
    "instagram_image": ("instagram", os.environ.get("LIVE_URL_INSTAGRAM_IMAGE", "")),
    "instagram_carousel": ("instagram", os.environ.get("LIVE_URL_INSTAGRAM_CAROUSEL", "")),
    "tiktok_video": ("tiktok", os.environ.get("LIVE_URL_TIKTOK_VIDEO", "")),
    "facebook_reel": ("facebook", os.environ.get("LIVE_URL_FACEBOOK_REEL", "")),
    "x_video": ("x", os.environ.get("LIVE_URL_X_VIDEO", "")),
    "reddit_video": ("reddit", os.environ.get("LIVE_URL_REDDIT_VIDEO", "")),
    "pinterest_pin": ("pinterest", os.environ.get("LIVE_URL_PINTEREST_PIN", "")),
}


def record(name, outcome):
    data = json.loads(REPORT.read_text()) if REPORT.exists() else {}
    data[name] = {"at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), **outcome}
    REPORT.write_text(json.dumps(data, indent=2))


@pytest.mark.parametrize("name", list(SAMPLES))
async def test_live_extract_and_download(name, tmp_path):
    platform, url = SAMPLES[name]
    if not url:
        record(name, {"result": "not_run", "reason": f"no sample URL (set LIVE_URL_{name.upper()})"})
        pytest.skip("no sample URL configured")
    ex = await run_worker(WORKER, {"op": "extract", "url": url, "platform": platform, "config": CFG}, timeout=90)
    if not ex.ok:
        record(name, {"result": "failed", "stage": "extract", "code": ex.code, "backend": ex.backend, "detail": ex.detail[:300]})
        pytest.fail(f"extract failed: {ex.code} ({ex.backend}): {ex.detail[:200]}")
    info = ex.result["info"]
    item = info["items"][0]
    fmt = item["formats"][-1]["id"]  # smallest offered option
    dl = await run_worker(WORKER, {"op": "download", "url": url, "platform": platform, "backend": info["backend"], "item_index": item["index"],
                                   "format_id": fmt, "multi": bool(info.get("extra", {}).get("multi")), "out_dir": str(tmp_path), "config": CFG}, timeout=300)
    if not dl.ok:
        record(name, {"result": "failed", "stage": "download", "code": dl.code, "backend": dl.backend, "detail": dl.detail[:300]})
        pytest.fail(f"download failed: {dl.code}")
    record(name, {"result": "passed", "backend": info["backend"], "items": len(info["items"]), "format": fmt, "bytes": dl.result["size"]})
