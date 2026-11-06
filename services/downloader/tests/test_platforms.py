import pytest

from app.errors import ApiError
from app.platforms import parse_media_url


@pytest.mark.parametrize("url,platform,ctype", [
    ("https://www.instagram.com/reel/C9xAbCdEfGh/", "instagram", "reel"),
    ("https://www.instagram.com/p/C9xAbCdEfGh/?img_index=2", "instagram", "post"),
    ("instagram.com/someuser/reel/C9xAbCdEfGh", "instagram", "reel"),
    ("https://www.instagram.com/tv/C9xAbCdEfGh/", "instagram", "video"),
    ("https://www.tiktok.com/@creator.name/video/7350000000000000000", "tiktok", "video"),
    ("https://www.tiktok.com/@creator/photo/7350000000000000001", "tiktok", "photo"),
    ("https://vm.tiktok.com/ZMabc123/", "tiktok", "short_link"),
    ("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "youtube", "video"),
    ("https://youtu.be/dQw4w9WgXcQ?t=10", "youtube", "video"),
    ("https://youtube.com/shorts/abcdEFGhijk", "youtube", "short"),
    ("https://m.youtube.com/watch?v=dQw4w9WgXcQ", "youtube", "video"),
    ("https://www.facebook.com/reel/1234567890", "facebook", "reel"),
    ("https://www.facebook.com/somepage/videos/1234567890/", "facebook", "video"),
    ("https://fb.watch/abcDEF/", "facebook", "video"),
    ("https://www.facebook.com/share/r/1AbCdE/", "facebook", "reel"),
    ("https://x.com/user/status/1790000000000000000", "x", "post"),
    ("https://twitter.com/user/status/1790000000000000000", "x", "post"),
    ("https://www.pinterest.com/pin/123456789/", "pinterest", "pin"),
    ("https://pin.it/abc123", "pinterest", "pin"),
    ("https://www.reddit.com/r/videos/comments/abc123/some_title/", "reddit", "post"),
    ("https://v.redd.it/abc123", "reddit", "post"),
    ("https://vimeo.com/76979871", "vimeo", "video"),
])
def test_recognises_supported_urls(url, platform, ctype):
    p = parse_media_url(url)
    assert p.platform.id == platform
    assert p.classification.content_type == ctype
    assert p.url.startswith("https://") and "#" not in p.url


@pytest.mark.parametrize("url,code", [
    ("", "invalid_request"),
    (None, "invalid_request"),
    (123, "invalid_request"),
    ("https://" + "a" * 3000 + ".com", "invalid_request"),
    ("https://www.youtube.com/watch?v=abc\nHost: evil", "invalid_request"),
    ("javascript:alert(1)", "unsafe_url"),
    ("file:///etc/passwd", "unsafe_url"),
    ("ftp://www.instagram.com/reel/abc", "unsafe_url"),
    ("gopher://www.youtube.com/", "unsafe_url"),
    ("http://127.0.0.1/reel/abc", "unsafe_url"),
    ("http://169.254.169.254/latest/meta-data/", "unsafe_url"),
    ("http://[::1]/", "unsafe_url"),
    ("http://2130706433/", "unsafe_url"),
    ("http://localhost:8080/", "unsafe_url"),
    ("https://user:pass@www.instagram.com/reel/abc", "unsafe_url"),
    ("https://www.instagram.com@evil.com/reel/abc", "unsafe_url"),
    ("https://www.instagram.com:8443/reel/abc", "unsafe_url"),
    ("https://example.com/video.mp4", "unsupported_url"),
    ("https://evil-instagram.com/reel/abc", "unsupported_url"),
    ("https://instagram.com.evil.io/reel/abc", "unsupported_url"),
    ("https://youtube.com.attacker.net/watch?v=x", "unsupported_url"),
    ("https://www.іnstagram.com/reel/abc", "unsupported_url"),  # Cyrillic і
    ("https://www.instagram.com/stories/someone/123/", "unsupported_content"),
    ("https://www.instagram.com/someone/", "unsupported_content"),
    ("https://www.youtube.com/playlist?list=PL123", "unsupported_content"),
    ("https://www.tiktok.com/@someone", "unsupported_content"),
])
def test_rejects_bad_urls(url, code):
    with pytest.raises(ApiError) as e:
        parse_media_url(url)
    assert e.value.code == code


def test_unsupported_content_names_platform():
    with pytest.raises(ApiError) as e:
        parse_media_url("https://www.instagram.com/stories/someone/1/")
    assert e.value.platform == "instagram"
    assert "Stories" in e.value.message


def test_normalises_url():
    p = parse_media_url("HTTP://WWW.YOUTUBE.COM:443/watch?v=dQw4w9WgXcQ#t=5")
    assert p.url == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
