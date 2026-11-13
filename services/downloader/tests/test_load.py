"""Concurrency, queueing and memory behaviour under load (fake worker, real subprocesses)."""
import resource
import threading
import time

from conftest import wait_job

YT = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"


def test_concurrent_jobs_respect_limits(make_client, settings):
    c = make_client(settings, max_concurrent_jobs=2, max_queued_jobs=30, max_active_jobs_per_client=1, trust_proxy_headers=True)
    svc = c.app.state.service
    peak = {"running": 0}
    stop = threading.Event()

    def sample():
        while not stop.is_set():
            peak["running"] = max(peak["running"], sum(1 for j in list(svc.jobs.values()) if j.status == "running"))
            time.sleep(0.005)

    t = threading.Thread(target=sample, daemon=True)
    t.start()
    rss_before = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    t0 = time.time()
    ids = []
    for i in range(24):
        r = c.post("/v1/jobs", json={"url": YT, "itemIndex": 0, "formatId": "v:best"}, headers={"x-real-ip": f"10.1.0.{i}"})
        assert r.status_code == 202, r.text
        ids.append(r.json()["id"])
    results = [wait_job(c, i, timeout=60) for i in ids]
    elapsed = time.time() - t0
    stop.set()
    rss_growth_mb = (resource.getrusage(resource.RUSAGE_SELF).ru_maxrss - rss_before) / 1024
    assert all(r["status"] == "done" for r in results)
    assert peak["running"] <= 2, peak
    assert rss_growth_mb < 100, rss_growth_mb
    print(f"\n[load] 24 jobs, concurrency 2: {elapsed:.1f}s total, peak running={peak['running']}, API RSS growth={rss_growth_mb:.1f} MB")
    # Temp storage is bounded by TTL; all files are inside TEMP_ROOT job dirs.
    assert len(list(settings.temp_root.iterdir())) == 24


def test_queue_overflow_is_rejected_not_buffered(make_client, settings):
    c = make_client(settings, max_concurrent_jobs=1, max_queued_jobs=3, max_active_jobs_per_client=10, job_timeout_seconds=5)
    codes = [c.post("/v1/jobs", json={"url": f"https://www.youtube.com/watch?v=slowjob{i}", "itemIndex": 0, "formatId": "v:best"}).status_code for i in range(6)]
    assert codes == [202, 202, 202, 503, 503, 503]
