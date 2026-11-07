import time

import pytest

from conftest import wait_job

YT = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"


def test_health(client):
    assert client.get("/healthz").json() == {"status": "ok"}
    r = client.get("/readyz")
    assert r.status_code == 200 and r.json()["checks"] == {"tempWritable": True, "ffmpeg": True, "extractor": True}


def test_extract_returns_public_shape(client):
    r = client.post("/v1/extract", json={"url": YT})
    assert r.status_code == 200
    d = r.json()
    assert d["platform"] == "youtube" and d["title"] == "Test clip"
    assert [f["id"] for f in d["items"][0]["formats"]] == ["v:best", "v:720", "a:best"]
    assert "backend" not in d and "extra" not in d


@pytest.mark.parametrize("url,status,code", [
    ("https://example.com/x.mp4", 422, "unsupported_url"),
    ("http://169.254.169.254/latest/meta-data/", 422, "unsafe_url"),
    ("https://www.instagram.com/stories/a/1/", 422, "unsupported_content"),
    ("", 400, "invalid_request"),
])
def test_extract_rejects_bad_urls(client, url, status, code):
    r = client.post("/v1/extract", json={"url": url})
    assert r.status_code == status and r.json()["error"]["code"] == code


def test_extractor_errors_identify_platform(client):
    r = client.post("/v1/extract", json={"url": "https://www.youtube.com/watch?v=private1"})
    assert r.status_code == 422
    assert r.json()["error"] == {"code": "private", "message": "This content is private, so it can't be downloaded.", "platform": "youtube"}
    r = client.post("/v1/extract", json={"url": "https://www.instagram.com/p/blocked1/"})
    assert r.status_code == 502 and r.json()["error"]["platform"] == "instagram"


def test_worker_crash_and_garbage_are_errors_not_success(client):
    for marker in ("crash", "garbage"):
        r = client.post("/v1/extract", json={"url": f"https://www.youtube.com/watch?v={marker}1"})
        assert r.status_code >= 500 and "error" in r.json()
        assert "Traceback" not in r.text and "/tmp" not in r.text


def test_extract_timeout(make_client, settings):
    c = make_client(settings, extract_timeout_seconds=1)
    r = c.post("/v1/extract", json={"url": "https://www.youtube.com/watch?v=slowextract"})
    assert r.status_code == 504 and r.json()["error"]["code"] == "timeout"


def test_request_validation(client):
    assert client.post("/v1/extract", content=b"not json", headers={"content-type": "application/json"}).json()["error"]["code"] == "invalid_request"
    assert client.post("/v1/extract", content=b"[1,2]", headers={"content-type": "application/json"}).status_code == 400
    r = client.post("/v1/extract", content=b"url=x", headers={"content-type": "application/x-www-form-urlencoded"})
    assert r.status_code == 400
    big = client.post("/v1/extract", json={"url": "https://youtu.be/x" + "a" * 20000})
    assert big.status_code == 413 and big.json()["error"]["code"] == "payload_too_large"
    assert client.get("/v1/extract").status_code == 405
    assert client.get("/nope").json()["error"]["code"] == "not_found"


def test_full_job_lifecycle_delivers_real_mp4(client, tmp_path, ffprobe_ok, settings):
    r = client.post("/v1/jobs", json={"url": YT, "itemIndex": 0, "formatId": "v:720"})
    assert r.status_code == 202
    job = r.json()
    assert job["status"] in ("queued", "running") and "downloadUrl" not in job
    done = wait_job(client, job["id"])
    assert done["status"] == "done" and done["progress"] == 100.0
    assert done["downloadUrl"] == f"/v1/jobs/{job['id']}/file"
    f = client.get(done["downloadUrl"])
    assert f.status_code == 200
    assert f.headers["content-type"] == "video/mp4"
    assert f.headers["content-disposition"] == f'attachment; filename="yonixtools-youtube-{job["id"][:8]}.mp4"'
    assert f.headers["cache-control"] == "no-store" and f.headers["x-content-type-options"] == "nosniff"
    out = tmp_path / "dl.mp4"
    out.write_bytes(f.content)
    codecs = {s["codec_type"]: s["codec_name"] for s in ffprobe_ok(out)["streams"]}
    assert codecs == {"video": "h264", "audio": "aac"}
    # Files live only inside the job directory under TEMP_ROOT.
    assert list((settings.temp_root / job["id"]).iterdir())[0].name == "media.mp4"


def test_carousel_item_download(client):
    url = "https://www.instagram.com/p/carousel1/"
    d = client.post("/v1/extract", json={"url": url}).json()
    assert len(d["items"]) == 3 and d["items"][2]["formats"][0]["id"] == "g:2"
    job = client.post("/v1/jobs", json={"url": url, "itemIndex": 2, "formatId": "g:2"}).json()
    done = wait_job(client, job["id"])
    assert done["status"] == "done"
    assert client.get(done["downloadUrl"]).headers["content-type"] == "image/jpeg"


@pytest.mark.parametrize("body,code", [
    ({"url": YT, "itemIndex": 0, "formatId": "bv*+ba; rm -rf /"}, "invalid_format"),
    ({"url": YT, "itemIndex": 0, "formatId": "v:2160"}, "invalid_format"),  # valid shape, not offered
    ({"url": YT, "itemIndex": 5, "formatId": "v:best"}, "invalid_format"),
    ({"url": YT, "itemIndex": -1, "formatId": "v:best"}, "invalid_request"),
    ({"url": YT, "itemIndex": True, "formatId": "v:best"}, "invalid_request"),
    ({"url": YT, "itemIndex": "0", "formatId": "v:best"}, "invalid_request"),
    ({"url": "https://www.youtube.com/watch?v=hugefile", "itemIndex": 0, "formatId": "v:best"}, "too_large"),
])
def test_job_validation(client, body, code):
    r = client.post("/v1/jobs", json=body)
    assert r.status_code in (400, 422) and r.json()["error"]["code"] == code


def test_failed_job_reports_code_and_cleans_up(client, settings):
    job = client.post("/v1/jobs", json={"url": "https://www.youtube.com/watch?v=failjob", "itemIndex": 0, "formatId": "v:best"}).json()
    done = wait_job(client, job["id"])
    assert done["status"] == "failed" and done["error"]["code"] == "unavailable"
    assert "downloadUrl" not in done
    assert not (settings.temp_root / job["id"]).exists()
    assert client.get(f"/v1/jobs/{job['id']}/file").status_code == 404


def test_worker_cannot_make_api_serve_files_outside_job_dir(client):
    job = client.post("/v1/jobs", json={"url": "https://www.youtube.com/watch?v=escape1", "itemIndex": 0, "formatId": "v:best"}).json()
    done = wait_job(client, job["id"])
    assert done["status"] == "failed" and done["error"]["code"] == "server_error"


def test_job_timeout_kills_worker_and_removes_partial_files(make_client, settings):
    c = make_client(settings, job_timeout_seconds=2)
    job = c.post("/v1/jobs", json={"url": "https://www.youtube.com/watch?v=slowjob", "itemIndex": 0, "formatId": "v:best"}).json()
    done = wait_job(c, job["id"], timeout=10)
    assert done["status"] == "failed" and done["error"]["code"] == "timeout"
    assert not (settings.temp_root / job["id"]).exists()


@pytest.mark.parametrize("jid", ["../../etc/passwd", "..%2F..%2Fetc%2Fpasswd", "abc", "a" * 200, "%00", "AAAAAAAAAAAAAAAAAAAAAAAA"])
def test_unknown_or_malicious_job_ids(client, jid):
    for path in (f"/v1/jobs/{jid}", f"/v1/jobs/{jid}/file"):
        r = client.get(path)
        assert r.status_code == 404
        assert "root:" not in r.text


def test_files_expire_and_are_deleted(make_client, settings):
    c = make_client(settings, file_ttl_seconds=1)
    job = c.post("/v1/jobs", json={"url": YT, "itemIndex": 0, "formatId": "a:best"}).json()
    done = wait_job(c, job["id"])
    assert c.get(done["downloadUrl"]).status_code == 200
    time.sleep(1.2)
    r = c.get(done["downloadUrl"])
    assert r.status_code == 410 and r.json()["error"]["code"] == "expired"
    assert c.get(f"/v1/jobs/{job['id']}").json()["status"] == "expired"
    assert not (settings.temp_root / job["id"]).exists()


def test_cleanup_forgets_old_jobs_and_removes_orphans(client, settings):
    svc = client.app.state.service
    job = client.post("/v1/jobs", json={"url": YT, "itemIndex": 0, "formatId": "v:best"}).json()
    wait_job(client, job["id"])
    orphan = settings.temp_root / "orphan-from-crash"
    orphan.mkdir()
    (orphan / "media.mp4.part").write_bytes(b"x")
    removed = svc.cleanup(now=time.time() + 10_000)
    assert removed >= 1 and not orphan.exists()
    assert job["id"] not in svc.jobs and not (settings.temp_root / job["id"]).exists()


def test_rate_limits(make_client, settings):
    c = make_client(settings, rate_extract=3)
    codes = [c.post("/v1/extract", json={"url": YT}).status_code for _ in range(5)]
    assert codes == [200, 200, 200, 429, 429]
    r = c.post("/v1/extract", json={"url": YT})
    assert r.headers["retry-after"] == "60" and r.json()["error"]["code"] == "rate_limited"


def test_per_client_and_global_job_caps(make_client, settings):
    c = make_client(settings, max_active_jobs_per_client=1, job_timeout_seconds=5)
    slow = lambda i: {"url": f"https://www.youtube.com/watch?v=slowjob{i}", "itemIndex": 0, "formatId": "v:best"}
    assert c.post("/v1/jobs", json=slow(1)).status_code == 202
    r = c.post("/v1/jobs", json=slow(2))
    assert r.status_code == 429 and "already have downloads" in r.json()["error"]["message"]
    c2 = make_client(settings, max_queued_jobs=1, max_active_jobs_per_client=5, job_timeout_seconds=5)
    assert c2.post("/v1/jobs", json=slow(1)).status_code == 202
    r = c2.post("/v1/jobs", json=slow(2))
    assert r.status_code == 503 and r.json()["error"]["code"] == "busy"


def test_low_disk_rejects_jobs(make_client, settings):
    c = make_client(settings, min_free_disk_mb=10**9)
    r = c.post("/v1/jobs", json={"url": YT, "itemIndex": 0, "formatId": "v:best"})
    assert r.status_code == 503 and r.json()["error"]["code"] == "busy"


def test_proxy_headers_only_trusted_when_configured(make_client, settings):
    c = make_client(settings, rate_extract=1)
    assert c.post("/v1/extract", json={"url": YT}, headers={"x-real-ip": "1.1.1.1"}).status_code == 200
    # Spoofed header ignored: same client, so limited.
    assert c.post("/v1/extract", json={"url": YT}, headers={"x-real-ip": "2.2.2.2"}).status_code == 429
    t = make_client(settings, rate_extract=1, trust_proxy_headers=True)
    assert t.post("/v1/extract", json={"url": YT}, headers={"x-real-ip": "3.3.3.3"}).status_code == 200
    assert t.post("/v1/extract", json={"url": YT}, headers={"x-real-ip": "4.4.4.4"}).status_code == 200


def test_cors_only_for_configured_origins(client):
    ok = client.options("/v1/extract", headers={"origin": "http://localhost:4173", "access-control-request-method": "POST", "access-control-request-headers": "content-type"})
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:4173"
    bad = client.options("/v1/extract", headers={"origin": "https://evil.example", "access-control-request-method": "POST"})
    assert "access-control-allow-origin" not in bad.headers


def test_internal_stats_not_reachable_remotely(client):
    assert client.get("/internal/stats").status_code == 404  # TestClient host is "testclient", not loopback


def test_stats_identify_failing_extractor(client):
    client.post("/v1/extract", json={"url": "https://www.youtube.com/watch?v=private2"})
    client.post("/v1/extract", json={"url": YT})
    counters = client.app.state.service.snapshot()["counters"]
    assert counters["extract.youtube.yt-dlp.fail.private"] == 1
    assert counters["extract.youtube.yt-dlp.ok"] == 1


def test_restart_purges_leftover_files(make_client, settings):
    settings.temp_root.mkdir(parents=True, exist_ok=True)
    stale = settings.temp_root / "job-before-restart"
    stale.mkdir()
    (stale / "media.mp4").write_bytes(b"old")
    c = make_client(settings)
    assert not stale.exists()
    assert c.get("/readyz").status_code == 200


def test_extraction_is_cached_for_job_creation(client):
    client.post("/v1/extract", json={"url": YT})
    client.post("/v1/jobs", json={"url": YT, "itemIndex": 0, "formatId": "v:best"})
    c = client.app.state.service.snapshot()["counters"]
    assert c["extract.youtube.yt-dlp.ok"] == 1 and c["extract.youtube.cache_hit"] == 1


def test_duplicate_requests_reuse_the_same_job(client):
    body = {"url": YT, "itemIndex": 0, "formatId": "v:720"}
    first = client.post("/v1/jobs", json=body).json()
    second = client.post("/v1/jobs", json=body).json()
    assert first["id"] == second["id"]
    other = client.post("/v1/jobs", json={**body, "formatId": "a:best"}).json()
    assert other["id"] != first["id"]
    done = wait_job(client, first["id"])
    assert done["phase"] == "ready"
    assert client.post("/v1/jobs", json=body).json()["id"] == first["id"]  # finished file is reused too
    assert client.app.state.service.stats["jobs.deduplicated"] == 2


def test_head_and_download_started_cookie(client):
    job = client.post("/v1/jobs", json={"url": YT, "itemIndex": 0, "formatId": "v:best"}).json()
    done = wait_job(client, job["id"])
    head = client.head(done["downloadUrl"])
    assert head.status_code == 200 and head.headers["content-type"] == "video/mp4" and head.content == b""
    assert "set-cookie" not in head.headers
    r = client.get(done["downloadUrl"] + "?dl=abc123def456")
    assert r.status_code == 200
    assert "ytx_dl_abc123def456=1" in r.headers["set-cookie"] and "Path=/" in r.headers["set-cookie"]
    bad = client.get(done["downloadUrl"] + "?dl=<script>")
    assert "set-cookie" not in bad.headers  # token is validated
    assert client.head("/v1/jobs/" + "A" * 24 + "/file").status_code == 404


def test_job_reports_phases(client):
    job = client.post("/v1/jobs", json={"url": YT, "itemIndex": 0, "formatId": "v:best"}).json()
    assert job["phase"] in ("queued", "downloading")
    assert wait_job(client, job["id"])["phase"] == "ready"
