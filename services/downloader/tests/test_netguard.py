import socket
import threading

import pytest

from app import netguard
from app.netguard import BlockedAddressError, check_public_host, install_socket_guard, is_public_ip, uninstall_socket_guard


@pytest.mark.parametrize("ip", ["10.0.0.1", "127.0.0.1", "127.1.2.3", "169.254.169.254", "172.16.5.4", "192.168.1.1", "100.64.0.1", "0.0.0.0",
                                "224.0.0.1", "255.255.255.255", "198.18.0.1", "::1", "::", "fe80::1", "fd00::1", "fc00::1", "::ffff:127.0.0.1",
                                "::ffff:10.0.0.1", "2002:7f00:1::1", "2001:db8::1", "64:ff9b::a00:1", "ff02::1", "not-an-ip", ""])
def test_blocks_non_public(ip):
    assert is_public_ip(ip) is False


@pytest.mark.parametrize("ip", ["8.8.8.8", "1.1.1.1", "157.240.1.35", "142.250.72.14", "2606:4700:4700::1111", "2a03:2880:f12f:83:face:b00c::25de"])
def test_allows_public(ip):
    assert is_public_ip(ip) is True


def test_check_public_host_rejects_ip_literals_and_private_dns():
    with pytest.raises(BlockedAddressError):
        check_public_host("127.0.0.1")
    with pytest.raises(BlockedAddressError):
        check_public_host("localhost")


def test_check_public_host_rejects_any_private_record(monkeypatch):
    # DNS returns one public and one private address: must be refused (rebinding / split answers).
    monkeypatch.setattr(netguard, "_original_getaddrinfo", lambda *a, **k: [
        (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("157.240.1.35", 443)),
        (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("10.0.0.5", 443)),
    ])
    with pytest.raises(BlockedAddressError):
        check_public_host("www.instagram.com")


def test_socket_guard_blocks_connections_to_local_services():
    srv = socket.socket()
    srv.bind(("127.0.0.1", 0))
    srv.listen(1)
    port = srv.getsockname()[1]
    threading.Thread(target=lambda: srv.accept(), daemon=True).start()
    install_socket_guard()
    try:
        with pytest.raises(BlockedAddressError):
            socket.create_connection(("localhost", port), timeout=2)
        with pytest.raises(BlockedAddressError):
            socket.create_connection(("127.0.0.1", port), timeout=2)
        # Binding a listening socket (AI_PASSIVE lookup) must still work.
        infos = socket.getaddrinfo("127.0.0.1", 0, socket.AF_INET, socket.SOCK_STREAM, 0, socket.AI_PASSIVE)
        assert infos
    finally:
        uninstall_socket_guard()
        srv.close()


def test_guard_also_applies_to_httpx():
    import httpx
    install_socket_guard()
    try:
        with pytest.raises(httpx.ConnectError):
            httpx.get("http://127.0.0.1:9/", timeout=2)
    finally:
        uninstall_socket_guard()


def test_curl_cffi_impersonation_requests_are_prechecked():
    """libcurl bypasses the getaddrinfo guard, so its requests get a host pre-check."""
    import yt_dlp
    from yt_dlp.networking import Request
    from yt_dlp.networking.impersonate import ImpersonateTarget

    from app.netguard import guard_curl_cffi
    import yt_dlp.networking._curlcffi as curl_mod

    called = []
    orig = curl_mod.CurlCFFIRH._send
    guard_curl_cffi()
    # The original send must never run for a private target.
    assert curl_mod.CurlCFFIRH._send is not orig or getattr(curl_mod.CurlCFFIRH, "_ytx_guarded", False)
    with yt_dlp.YoutubeDL({"quiet": True}) as y:
        for target in ("https://127.0.0.1/", "https://localhost/", "https://169.254.169.254/latest/meta-data/"):
            with pytest.raises(Exception):
                y.urlopen(Request(target, extensions={"impersonate": ImpersonateTarget("chrome")}))
    assert called == []


def test_ipv4_only_drops_ipv6_answers(monkeypatch):
    import socket
    from app import netguard
    fake = [(socket.AF_INET6, socket.SOCK_STREAM, 6, "", ("2a03:2880:f12f:83:face:b00c:0:25de", 443, 0, 0)),
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("157.240.22.35", 443))]
    monkeypatch.setattr(netguard, "_original_getaddrinfo", lambda *a, **k: fake)
    monkeypatch.setenv("YTX_IPV4_ONLY", "1")
    assert [r[0] for r in netguard._filtered_getaddrinfo("www.facebook.com", 443)] == [socket.AF_INET]
    monkeypatch.setenv("YTX_IPV4_ONLY", "0")
    assert len(netguard._filtered_getaddrinfo("www.facebook.com", 443)) == 2


def test_ipv4_only_sets_ytdlp_source_address(monkeypatch):
    from app.adapters.ytdlp_backend import YtDlpBackend
    monkeypatch.setenv("YTX_IPV4_ONLY", "1")
    assert YtDlpBackend(("x",), 1, 1, 1)._opts()["source_address"] == "0.0.0.0"
    monkeypatch.setenv("YTX_IPV4_ONLY", "0")
    assert "source_address" not in YtDlpBackend(("x",), 1, 1, 1)._opts()
