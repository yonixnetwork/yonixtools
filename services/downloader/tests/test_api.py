import time
import json

import pytest

from conftest import wait_job

YT = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"


def test_health(client):
    assert client.get("/healthz").json() == {"status": "ok"}
    r = client.get("/readyz")
    # Visitors (anything not on the server itself) get the status only, no internal checks.
    assert r.status_code == 200 and r.json() == {"status": "ok"}


def test_readyz_details_only_for_the_server_itself(make_client, settings):
    from fastapi.testclient import TestClient
    from app.main import create_app
    with TestClient(create_app(settings), client=("127.0.0.1", 50000)) as local:
        assert local.get("/readyz").json()["checks"] == {"tempWritable": True, "ffmpeg": True, "extractor": True}
        # The same request through the reverse proxy (it always sets X-Real-IP) gets no details.
        assert "checks" not in local.get("/readyz", headers={"X-Real-IP": "203.0.113.9"}).json()
        assert local.get("/internal/stats", headers={"X-Real-IP": "203.0.113.9"}).status_code == 404
        assert local.get("/internal/stats").status_code == 200


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


# ── Universal media: mixed posts, images, conversions, ZIP, previews ─────────
MIXED = "https://www.instagram.com/p/mixedpost1/"


def test_mixed_post_is_described_item_by_item(client):
    d = client.post("/v1/extract", json={"url": MIXED}).json()
    assert d["mediaType"] == "mixed"
    assert [i["kind"] for i in d["items"]] == ["video", "image", "image"]
    img = d["items"][1]
    assert (img["width"], img["height"]) == (1080, 1350)
    assert [f["id"] for f in img["formats"]] == ["i:best", "i:640"]
    assert img["conversions"] == ["jpg", "png", "webp"]
    assert "a:mp3" in [f["id"] for f in d["items"][0]["formats"]]
    # Thumbnails are served same-origin through opaque preview tokens; CDN URLs and sources never reach the browser.
    assert img["thumbnail"].startswith("/v1/preview/") and "cdn.example" not in json.dumps(d)


def test_image_download_uses_the_source_found_during_extraction(client):
    job = client.post("/v1/jobs", json={"url": MIXED, "itemIndex": 2, "formatId": "i:640"}).json()
    done = wait_job(client, job["id"])
    r = client.get(done["downloadUrl"])
    assert r.headers["content-type"] == "image/jpeg"
    assert json.loads(r.content.decode().strip())["url"] == "https://cdn.example/2-640.jpg"


def test_image_conversion_is_only_for_images(client):
    job = client.post("/v1/jobs", json={"url": MIXED, "itemIndex": 1, "formatId": "i:best~png"}).json()
    done = wait_job(client, job["id"])
    assert client.get(done["downloadUrl"]).headers["content-type"] == "image/png"
    r = client.post("/v1/jobs", json={"url": MIXED, "itemIndex": 0, "formatId": "v:best~png"})
    assert r.status_code == 422 and r.json()["error"]["code"] == "invalid_format"


def test_zip_of_selected_items(client):
    job = client.post("/v1/jobs", json={"url": MIXED, "formatId": "zip", "items": [2, 1]}).json()
    done = wait_job(client, job["id"])
    r = client.get(done["downloadUrl"])
    assert r.headers["content-type"] == "application/zip"
    assert r.headers["content-disposition"].endswith('.zip"')
    import io
    import zipfile
    z = zipfile.ZipFile(io.BytesIO(r.content))
    parts = [json.loads(z.read(n)) for n in sorted(z.namelist())]
    assert [(p["item_index"], p["format_id"]) for p in parts] == [(1, "i:best"), (2, "i:best")]
    assert parts[0]["source"]["url"] == "https://cdn.example/1-1080.jpg"


@pytest.mark.parametrize("items", [None, [1], [1, 1], [0, 99], ["1", "2"], [True, 2], list(range(40))])
def test_zip_validation(client, items):
    r = client.post("/v1/jobs", json={"url": MIXED, "formatId": "zip", "items": items})
    assert r.status_code in (400, 422)


def test_preview_tokens_are_opaque_and_unknown_ones_404(client):
    assert client.get("/v1/preview/" + "0" * 32).status_code == 404
    assert client.get("/v1/preview/../../etc/passwd").status_code == 404
    assert client.get("/v1/preview/http%3A%2F%2F169.254.169.254%2F").status_code == 404


@pytest.mark.parametrize("target", ["https://127.0.0.1/x.jpg", "https://169.254.169.254/latest/meta-data/", "https://10.0.0.5/a.png",
                                    "https://localhost/a.png", "http://example.com/a.jpg"])
def test_preview_proxy_never_reaches_internal_addresses(client, target):
    from app.media import MediaFormat, MediaInfo, MediaItem
    svc = client.app.state.service
    pub = svc.public_info(MediaInfo("instagram", "yt-dlp", "t", [MediaItem(0, "image", [MediaFormat("i:best", "Original", "jpg", "image")], target)]))
    tok = pub["items"][0]["thumbnail"]
    if target.startswith("http://"):
        assert tok is None  # never proxied
        return
    r = client.get(tok)
    assert r.status_code == 404
