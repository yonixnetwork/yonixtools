"""Outbound network safety (SSRF defence).

Two layers:

1. ``check_public_host`` validates a hostname before we use it: every address
   it resolves to must be a public, globally routable unicast address.
2. ``install_socket_guard`` patches ``socket.getaddrinfo`` in the current
   process so *every* outbound connection, including ones made inside
   yt-dlp, gallery-dl or httpx, can only reach public addresses. A hostname
   that resolves to a private address is refused at connect time, which
   also defeats DNS rebinding (a re-resolution is filtered again).

The guard is installed in the API process and in every worker process.
FFmpeg is only ever given local files (HLS/DASH are fetched natively by
yt-dlp inside the guarded Python process).
"""
from __future__ import annotations

import ipaddress
import socket
from typing import Any

_original_getaddrinfo = socket.getaddrinfo
_installed = False

# Explicit extra blocks on top of ipaddress' is_global (defence in depth).
_BLOCKED_NETS = [ipaddress.ip_network(n) for n in (
    "0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8", "169.254.0.0/16", "172.16.0.0/12",
    "192.0.0.0/24", "192.0.2.0/24", "192.88.99.0/24", "192.168.0.0/16", "198.18.0.0/15", "198.51.100.0/24",
    "203.0.113.0/24", "224.0.0.0/4", "240.0.0.0/4", "255.255.255.255/32",
    "::/128", "::1/128", "::ffff:0:0/96", "64:ff9b::/96", "100::/64", "2001::/23", "2001:db8::/32",
    "fc00::/7", "fe80::/10", "ff00::/8",
)]


class BlockedAddressError(OSError):
    pass


def is_public_ip(value: str | ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    try:
        ip = ipaddress.ip_address(value) if isinstance(value, str) else value
    except ValueError:
        return False
    if isinstance(ip, ipaddress.IPv6Address):
        # Unwrap IPv4-mapped / 6to4 / Teredo forms so they can't smuggle a private v4 address.
        if ip.ipv4_mapped:
            return is_public_ip(ip.ipv4_mapped)
        if ip.sixtofour:
            return is_public_ip(ip.sixtofour)
        if ip.teredo:
            return False
    if not ip.is_global or ip.is_multicast or ip.is_reserved or ip.is_loopback or ip.is_link_local or ip.is_private or ip.is_unspecified:
        return False
    return not any(ip in net for net in _BLOCKED_NETS if net.version == ip.version)


def _filtered_getaddrinfo(host: Any, *args: Any, **kwargs: Any):
    # Lookups for binding a listening socket (AI_PASSIVE) are not outbound connections.
    flags = kwargs.get("flags", args[4] if len(args) > 4 else 0)
    if flags & socket.AI_PASSIVE:
        return _original_getaddrinfo(host, *args, **kwargs)
    results = _original_getaddrinfo(host, *args, **kwargs)
    safe = [r for r in results if r[0] in (socket.AF_INET, socket.AF_INET6) and is_public_ip(r[4][0].split("%")[0])]
    if not safe:
        raise BlockedAddressError(f"Refusing to connect to non-public address for {host!r}")
    return safe


def install_socket_guard() -> None:
    """Idempotently restrict all outbound connections of this process to public IPs."""
    global _installed
    if _installed:
        return
    socket.getaddrinfo = _filtered_getaddrinfo  # type: ignore[assignment]
    _installed = True


def uninstall_socket_guard() -> None:
    """For tests only."""
    global _installed
    socket.getaddrinfo = _original_getaddrinfo  # type: ignore[assignment]
    _installed = False


def check_public_host(host: str, port: int = 443) -> list[str]:
    """Resolve ``host`` and require that *all* addresses are public. Returns the addresses."""
    try:
        ipaddress.ip_address(host.strip("[]"))
        raise BlockedAddressError("IP-address URLs are not allowed")
    except ValueError:
        pass
    try:
        infos = _original_getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except socket.gaierror as e:
        raise BlockedAddressError(f"Could not resolve {host!r}") from e
    addrs = sorted({i[4][0].split("%")[0] for i in infos})
    if not addrs or not all(is_public_ip(a) for a in addrs):
        raise BlockedAddressError(f"{host!r} resolves to a non-public address")
    return addrs


def guard_curl_cffi() -> None:
    """Pre-check hosts of yt-dlp's libcurl (impersonation) requests.

    libcurl resolves names in C, outside the getaddrinfo guard, and follows
    redirects itself. This refuses requests whose host resolves to a non-public
    address; redirects are additionally covered by the host egress firewall
    (deploy/scripts/egress-firewall.sh).
    """
    try:
        from yt_dlp.networking import _curlcffi
    except Exception:  # curl_cffi not installed
        return
    handler = getattr(_curlcffi, "CurlCFFIRH", None)
    if handler is None or getattr(handler, "_ytx_guarded", False):
        return
    original = handler._send
    from urllib.parse import urlsplit

    def _send(self, request):  # type: ignore[no-untyped-def]
        host = urlsplit(request.url).hostname or ""
        check_public_host(host)
        return original(self, request)

    handler._send = _send
    handler._ytx_guarded = True
