import httpx
import pytest

import app.resolver as resolver_mod
from app.errors import ApiError
from app.platforms import parse_media_url

real_resolve = resolver_mod.resolve_short_link


@pytest.fixture(autouse=True)
def public_dns(monkeypatch):
    monkeypatch.setattr(resolver_mod, "check_public_host", lambda host, port=443: ["157.240.1.35"])


def transport(routes):
    def handler(request: httpx.Request):
        loc = routes.get(str(request.url))
        if loc is None:
            return httpx.Response(200, text="ok")
        if isinstance(loc, int):
            return httpx.Response(loc)
        return httpx.Response(302, headers={"location": loc})
    return httpx.AsyncClient(transport=httpx.MockTransport(handler), follow_redirects=False)


async def test_resolves_pin_it():
    c = transport({"https://pin.it/abc123": "https://www.pinterest.com/pin/987654321/"})
    p = await real_resolve(parse_media_url("https://pin.it/abc123"), c)
    assert p.url == "https://www.pinterest.com/pin/987654321/" and not p.classification.needs_resolution


async def test_resolves_tiktok_short_link_through_hops():
    c = transport({"https://vm.tiktok.com/ZMabc/": "https://m.tiktok.com/v/735.html", "https://m.tiktok.com/v/735.html": "https://www.tiktok.com/@a/video/7350000000000000000"})
    p = await real_resolve(parse_media_url("https://vm.tiktok.com/ZMabc/"), c)
    assert p.classification.content_type == "video"


@pytest.mark.parametrize("target", [
    "https://evil.example/steal",
    "http://www.pinterest.com/pin/1/",  # downgrade to http
    "https://169.254.169.254/latest/meta-data/",
    "https://localhost/",
    "https://pinterest.com.evil.io/pin/1/",
])
async def test_rejects_redirect_off_platform(target):
    c = transport({"https://pin.it/abc123": target})
    with pytest.raises(ApiError) as e:
        await real_resolve(parse_media_url("https://pin.it/abc123"), c)
    assert e.value.code == "unsafe_url"


async def test_rejects_redirect_loops():
    c = transport({"https://pin.it/a": "https://pin.it/b", "https://pin.it/b": "https://pin.it/a"})
    with pytest.raises(ApiError) as e:
        await real_resolve(parse_media_url("https://pin.it/a"), c)
    assert e.value.code == "unsafe_url"


async def test_rejects_platform_host_resolving_to_private_ip(monkeypatch):
    from app.netguard import BlockedAddressError

    def private(host, port=443):
        raise BlockedAddressError("private")
    monkeypatch.setattr(resolver_mod, "check_public_host", private)
    with pytest.raises(ApiError) as e:
        await real_resolve(parse_media_url("https://pin.it/abc123"), transport({}))
    assert e.value.code == "unsafe_url"


async def test_dead_short_link_is_unavailable():
    c = transport({"https://pin.it/dead": 404})
    with pytest.raises(ApiError) as e:
        await real_resolve(parse_media_url("https://pin.it/dead"), c)
    assert e.value.code == "unavailable"


async def test_non_short_links_are_untouched():
    p = parse_media_url("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
    assert await real_resolve(p, transport({})) is p
