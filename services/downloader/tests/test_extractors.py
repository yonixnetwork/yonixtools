import pytest
import yt_dlp

from app.adapters.chain import ExtractionFailed, extract
from app.adapters.errors import classify_error
from app.adapters.ytdlp_backend import BackendError, YtDlpBackend
from app.media import FORMAT_ID_RE
from app.platforms import PLATFORMS


def backend(**kw):
    return YtDlpBackend(("youtube",), kw.get("max_filesize", 500 * 2**20), kw.get("max_duration", 3600), kw.get("max_items", 20))


@pytest.mark.parametrize("pid", list(PLATFORMS))
def test_only_platform_extractors_are_loaded(pid):
    b = YtDlpBackend(PLATFORMS[pid].ytdlp_extractors, 1, 1, 1)
    with yt_dlp.YoutubeDL(b._opts()) as ydl:
        names = {ie.IE_NAME.lower() for ie in ydl._ies.values()}
    assert names == set(PLATFORMS[pid].ytdlp_extractors)
    assert "generic" not in names


def test_restricted_ytdlp_refuses_unrelated_urls():
    with pytest.raises(BackendError) as e:
        backend().extract("https://example.com/video.mp4", "youtube")
    assert classify_error(e.value.detail) == "unsupported_content"


def fmt(fid, h=None, v="avc1", a="none", ext="mp4", size=None, abr=None):
    return {"format_id": fid, "url": f"https://cdn/{fid}", "height": h, "vcodec": v, "acodec": a, "ext": ext, "filesize": size, "abr": abr}


def test_maps_video_formats_to_quality_ladder():
    info = {"title": "Clip", "uploader": "Someone", "thumbnail": "https://i/t.jpg", "duration": 30, "formats": [
        fmt("137", 1080, size=9_000_000), fmt("136", 720, size=5_000_000), fmt("135", 480, size=2_000_000), fmt("134", 360),
        fmt("140", None, v="none", a="mp4a", ext="m4a", size=500_000, abr=128)]}
    m = backend().to_media(info, "youtube")
    ids = [f.id for f in m.items[0].formats]
    assert ids == ["v:best", "v:720", "v:480", "v:360", "a:best"]
    assert all(FORMAT_ID_RE.match(i) for i in ids)
    assert m.items[0].formats[0].filesize == 9_500_000
    assert m.items[0].formats[-1].ext == "m4a"
    assert m.title == "Clip" and m.author == "Someone"


def test_maps_carousel_entries():
    info = {"_type": "playlist", "title": "Post", "entries": [
        {"title": "a", "formats": [fmt("v", 640)]},
        {"title": "b", "formats": [{"url": "https://cdn/img.jpg", "ext": "jpg", "vcodec": "none", "acodec": "none", "width": 1080, "height": 1350}]},
    ]}
    m = backend().to_media(info, "instagram")
    assert [i.kind for i in m.items] == ["video", "image"]
    assert m.items[1].formats[0].id == "i:best"
    assert m.extra["multi"] is True


@pytest.mark.parametrize("info,code", [
    ({"title": "x", "is_live": True, "formats": [fmt("1", 720)]}, "live_stream"),
    ({"title": "x", "duration": 99999, "formats": [fmt("1", 720)]}, "too_long"),
    ({"title": "x", "formats": [{**fmt("1", 720), "has_drm": True}]}, "drm_protected"),
    ({"_type": "playlist", "title": "x", "entries": []}, "no_media"),
])
def test_rejects_unusable_media(info, code):
    with pytest.raises(BackendError) as e:
        backend().to_media(info, "youtube")
    assert e.value.code == code


def test_selectors_are_fixed_strings():
    assert YtDlpBackend.selector("v:720").startswith("bv*[height<=720]")
    assert YtDlpBackend.selector("a:best") == "ba[ext=m4a]/ba"
    assert YtDlpBackend.selector("i:best") == "b/best"


@pytest.mark.parametrize("bad", ["bv*+ba", "v:best;rm -rf /", "../x", "v:99999", "g:abc", "", "f:worst"])
def test_format_id_whitelist(bad):
    assert not FORMAT_ID_RE.match(bad)


@pytest.mark.parametrize("msg,code", [
    ("ERROR: [Instagram] abc: Requested content is not available, rate-limit reached or login required", "login_required"),
    ("ERROR: [youtube] x: Private video. Sign in if you've been granted access", "private"),
    ("ERROR: [youtube] x: Sign in to confirm your age", "age_restricted"),
    ("ERROR: [youtube] x: Sign in to confirm you're not a bot", "platform_blocked"),
    ("ERROR: [youtube] x: Video unavailable", "unavailable"),
    ("ERROR: [Instagram] x: There is no video in this post", "no_media"),
    ("ERROR: Unsupported URL: https://x", "unsupported_content"),
    ("ERROR: unable to download video data: HTTP Error 429: Too Many Requests", "platform_blocked"),
    ("ERROR: This video is DRM protected", "drm_protected"),
    ("ERROR: [youtube] x: This live event will begin in 3 hours", "live_stream"),
    ("ERROR: [youtube] x: Unable to download API page: Failed to resolve 'www.youtube.com' ([Errno -2] Name or service not known)", "network_error"),
    ("something odd", "extractor_failed"),
])
def test_error_classification(msg, code):
    assert classify_error(msg) == code


class Stub:
    def __init__(self, name, result=None, error=None):
        self.name, self.result, self.error, self.calls = name, result, error, 0

    def extract(self, url, platform):
        self.calls += 1
        if self.error:
            raise BackendError("raw", self.error)
        return self.result


def test_chain_falls_back_for_image_posts():
    ok = object()
    a, b = Stub("yt-dlp", error="There is no video in this post"), Stub("gallery-dl", result=ok)
    assert extract(PLATFORMS["instagram"], "u", {}, [a, b]) is ok
    assert (a.calls, b.calls) == (1, 1)


def test_chain_does_not_fall_back_for_private_content():
    a, b = Stub("yt-dlp", error="This account is private"), Stub("gallery-dl", result=object())
    with pytest.raises(ExtractionFailed) as e:
        extract(PLATFORMS["instagram"], "u", {}, [a, b])
    assert e.value.code == "private" and e.value.backend == "yt-dlp" and b.calls == 0


def test_chain_reports_first_error_when_all_fail():
    a, b = Stub("yt-dlp", error="There is no video in this post"), Stub("gallery-dl", error="weird failure")
    with pytest.raises(ExtractionFailed) as e:
        extract(PLATFORMS["instagram"], "u", {}, [a, b])
    assert e.value.code == "no_media" and e.value.backend == "yt-dlp"


def test_storyboards_are_not_offered_as_video():
    info = {"title": "x", "formats": [fmt("sb0", 90, v="none", ext="mhtml") | {"protocol": "mhtml", "format_note": "storyboard"}]}
    with pytest.raises(BackendError) as e:
        backend().to_media(info, "youtube")
    assert e.value.code == "no_media"
    info["formats"].append(fmt("18", 360, a="mp4a"))
    assert [f.id for f in backend().to_media(info, "youtube").items[0].formats] == ["v:best"]


def test_watermark_labels_are_honest():
    clean_and_marked = {"title": "x", "formats": [fmt("dl", 720, a="aac") | {"format_note": "watermarked"}, fmt("play", 720, a="aac") | {"format_note": "Direct video"}]}
    assert "no watermark" in backend().to_media(clean_and_marked, "tiktok").items[0].formats[0].label
    only_marked = {"title": "x", "formats": [fmt("dl", 720, a="aac") | {"format_note": "watermarked"}]}
    assert backend().to_media(only_marked, "tiktok").items[0].formats[0].label.endswith("watermarked")
    plain = {"title": "x", "formats": [fmt("a", 720, a="aac")]}
    assert "watermark" not in backend().to_media(plain, "youtube").items[0].formats[0].label
    assert "format_note!*=watermark" in YtDlpBackend.selector("v:best")


def test_no_duplicate_quality_options():
    same = {"title": "x", "duration": 10, "formats": [fmt("hd", 1080, a="aac", size=5_000_000), fmt("sd", 720, a="aac", size=5_000_000)]}
    ids = [f.id for f in backend().to_media(same, "x").items[0].formats]
    assert ids == ["v:best"]  # 720p would be the very same file size: not offered as a separate choice
