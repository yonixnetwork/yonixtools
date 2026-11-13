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
    assert ids == ["v:best", "v:720", "v:480", "v:360", "a:best", "a:mp3"]
    assert all(FORMAT_ID_RE.match(i) for i in ids)
    assert m.items[0].formats[0].filesize == 9_500_000
    assert m.items[0].formats[-2].ext == "m4a" and m.items[0].formats[-1].ext == "mp3"
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
    assert [f.id for f in backend().to_media(info, "youtube").items[0].formats] == ["v:best", "a:mp3"]


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
    assert ids == ["v:best", "a:mp3"]  # 720p would be the very same file size: not offered as a separate choice


# ── Evidence-driven fixes (see docs/PLATFORM_DIAGNOSTICS.md) ─────────────────
from app.adapters.chain import backends_for  # noqa: E402
from app.errors import message_for  # noqa: E402

CFG = {"max_filesize": 10**8, "max_duration": 3600, "max_items": 10, "timeout": 60}


def test_vimeo_has_no_fallback_that_would_list_undownloadable_formats():
    assert [b.name for b in backends_for(PLATFORMS["vimeo"], CFG)] == ["yt-dlp"]


def test_login_wall_does_not_fall_back_on_other_platforms():
    a, b = Stub("yt-dlp", error="Instagram: login required"), Stub("gallery-dl", result=object())
    with pytest.raises(ExtractionFailed) as e:
        extract(PLATFORMS["instagram"], "u", {}, [a, b])
    assert e.value.code == "login_required" and b.calls == 0


def test_platform_specific_messages():
    assert "isn't a bot" in message_for("platform_blocked", "youtube")
    assert "Reddit" in message_for("login_required", "reddit")
    assert message_for("platform_blocked", "tiktok") == message_for("platform_blocked", None)
    assert classify_error("ERROR: [TikTok] 725: Your IP address is blocked from accessing this post") == "geo_blocked"
    assert classify_error("ERROR: [youtube] x: Sign in to confirm you’re not a bot. This helps protect our community.") == "platform_blocked"


def test_audio_only_sources_get_an_audio_option():
    info = {"title": "Track", "duration": 200, "formats": [
        {"format_id": "hls_mp3", "url": "https://x/a.m3u8", "ext": "mp3", "vcodec": "none", "acodec": "mp3", "abr": 128},
        {"format_id": "hls_opus", "url": "https://x/b.m3u8", "ext": "opus", "vcodec": "none", "acodec": "opus", "abr": 64}]}
    m = YtDlpBackend(("soundcloud",), 10**8, 3600, 10).to_media(info, "soundcloud")
    assert m.items[0].kind == "audio" and [f.id for f in m.items[0].formats] == ["a:best"]
    assert m.items[0].formats[0].ext == "mp3"


def test_single_url_sources_without_format_list_still_offer_the_original():
    info = {"title": "Clip", "url": "https://clips-media.example/clip.mp4", "ext": "mp4", "height": 720, "vcodec": "avc1", "acodec": "mp4a"}
    m = YtDlpBackend(("twitch:clips",), 10**8, 3600, 10).to_media(info, "twitch")
    assert m.items[0].formats[0].id == "v:best"


def test_drm_formats_are_removed_before_selection():
    from app.adapters.ytdlp_backend import _strip_unusable
    info = {"formats": [{"format_id": "dash-drm", "has_drm": True}, {"format_id": "hls-720"}, {"format_id": "sb0", "protocol": "mhtml"}],
            "entries": [{"formats": [{"format_id": "x", "has_drm": True}, {"format_id": "y"}]}]}
    out = _strip_unusable(info)
    assert [f["format_id"] for f in out["formats"]] == ["hls-720"]
    assert [f["format_id"] for f in out["entries"][0]["formats"]] == ["y"]
    assert _strip_unusable(None) is None


# ── Universal media: image items, audio, conversion, fetch safety ────────────
from app.adapters.ytdlp_backend import convert_image, fetch_source  # noqa: E402
from app.media import media_type, split_format  # noqa: E402

IG_CAROUSEL = {"_type": "playlist", "title": "Post by nasa", "entries": [
    {"id": "1", "formats": [], "http_headers": {"Referer": "https://www.instagram.com/", "Cookie": "x=1"}, "thumbnails": [
        {"url": "https://scontent.cdninstagram.com/a_640.jpg?x=1", "width": 640, "height": 800},
        {"url": "https://scontent.cdninstagram.com/a_1080.jpg?x=1", "width": 1080, "height": 1350},
        {"url": "https://scontent.cdninstagram.com/a_1080b.jpg", "width": 1080, "height": 1350},  # duplicate size: not a separate choice
        {"url": "http://insecure.example/a.jpg", "width": 2000, "height": 2500}]},  # not https: ignored
    {"id": "2", "duration": 9, "formats": [fmt("v1", 720, a="aac")], "thumbnails": [{"url": "https://scontent.cdninstagram.com/v.jpg", "width": 640, "height": 800}]},
    {"id": "3", "formats": [], "thumbnails": [{"url": "https://scontent.cdninstagram.com/c.webp", "width": 1080, "height": 1080}]},
]}


def test_instagram_carousel_images_come_with_their_real_sizes_only():
    m = backend().to_media(IG_CAROUSEL, "instagram")
    assert [i.kind for i in m.items] == ["image", "video", "image"]
    assert media_type(m.items) == "mixed"
    img = m.items[0]
    assert (img.width, img.height) == (1080, 1350)
    assert [(f.id, f.label) for f in img.formats] == [("i:best", "Original · 1080×1350 · JPG"),
                                                      ("i:640", "640×800 · JPG (smaller copy from the platform)")]
    src = m.extra["sources"]["0:i:best"]
    assert src["url"].endswith("a_1080.jpg?x=1")
    assert src["headers"] == {"Referer": "https://www.instagram.com/"}  # cookies never forwarded
    # A single-size image says it's the original, with no invented alternatives.
    assert [f.label for f in m.items[2].formats] == ["Original · 1080×1080 · WEBP"]


def test_format_less_entries_are_not_images_elsewhere():
    # On other platforms a format-less entry means "nothing downloadable", not "image".
    info = {"title": "x", "formats": [], "thumbnails": [{"url": "https://t/x.jpg", "width": 640, "height": 360}]}
    with pytest.raises(BackendError):
        backend().to_media(info, "youtube")


def test_media_types():
    from app.media import MediaItem
    v, i, a = (MediaItem(0, "video", []), MediaItem(1, "image", []), MediaItem(2, "audio", []))
    assert [media_type(x) for x in ([v], [v, v], [i], [i, i], [a], [v, i])] == ["video", "videos", "image", "images", "audio", "mixed"]
    assert split_format("i:best~png") == ("i:best", "png") and split_format("v:720") == ("v:720", None)


def test_audio_only_sources_offer_original_and_mp3():
    info = {"title": "Track", "formats": [{"format_id": "opus", "url": "https://x/a", "ext": "opus", "vcodec": "none", "acodec": "opus", "abr": 160}]}
    fs = backend().to_media(info, "soundcloud").items[0].formats
    assert [(f.id, f.ext) for f in fs] == [("a:best", "opus"), ("a:mp3", "mp3")]
    mp3 = {"title": "Track", "formats": [{"format_id": "mp3", "url": "https://x/a", "ext": "mp3", "vcodec": "none", "acodec": "mp3", "abr": 128}]}
    assert [f.id for f in backend().to_media(mp3, "soundcloud").items[0].formats] == ["a:best"]  # already MP3: no pointless conversion


def test_silent_or_unknown_audio_video_gets_no_mp3_option():
    info = {"title": "x", "formats": [fmt("v", 720)]}  # acodec "none"
    assert "a:mp3" not in [f.id for f in backend().to_media(info, "instagram").items[0].formats]


@pytest.mark.parametrize("src", [{"url": "http://example.com/a.jpg"}, {"url": "file:///etc/passwd"}, {"url": None}, {}])
def test_fetch_source_refuses_non_https(tmp_path, src):
    with pytest.raises(BackendError) as e:
        fetch_source(src, tmp_path / "media", 10**6)
    assert e.value.code == "unsafe_url"


def test_convert_image_with_ffmpeg(tmp_path):
    import subprocess
    src = tmp_path / "media.png"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=size=64x48", "-frames:v", "1", str(src)], check=True)
    out = convert_image(src, "jpg")
    assert out.name == "media.jpg" and out.read_bytes()[:3] == b"\xff\xd8\xff" and not src.exists()
    out2 = convert_image(out, "webp")
    assert out2.name == "media.webp" and out2.read_bytes()[8:12] == b"WEBP"
    assert convert_image(out2, "webp") == out2  # same format: no re-encode
    with pytest.raises(BackendError):
        convert_image(out2, "exe")


def test_anonymous_instagram_images_without_dimensions_still_work():
    # Logged-out Instagram returns one display URL per carousel item, without sizes (live matrix run 5).
    info = {"_type": "playlist", "entries": [
        {"id": str(i), "formats": [], "width": 1080, "height": 1080 if i else None,
         "thumbnails": [{"url": f"https://scontent.cdninstagram.com/s{i}.jpg"}, {"url": f"https://scontent.cdninstagram.com/{i}.jpg?stp=1"}]} for i in range(5)]}
    m = backend().to_media(info, "instagram")
    assert [i.kind for i in m.items] == ["image"] * 5 and media_type(m.items) == "images"
    assert m.items[1].formats[0].label == "Original · 1080×1080 · JPG"
    assert m.items[0].formats[0].label == "Original · JPG"  # unknown size: not guessed
    assert m.extra["sources"]["3:i:best"]["url"] == "https://scontent.cdninstagram.com/3.jpg?stp=1"


def test_gif_posts_with_mp4_copies_are_videos_not_images():
    # Imgur "gifv" (live matrix run 7): a .gif entry plus MP4 entries without codec info.
    info = {"title": "gif", "formats": [{"format_id": "gif", "url": "https://i.imgur.com/a.gif", "ext": "gif"},
                                        {"format_id": "mp4", "url": "https://i.imgur.com/a.mp4", "ext": "mp4", "width": 480}]}
    it = backend().to_media(info, "imgur").items[0]
    assert it.kind == "video" and it.formats[0].id == "v:best"
