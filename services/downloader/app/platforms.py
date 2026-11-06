"""Supported platforms: host allowlist, URL classification and extractor mapping.

This module is the backend's source of truth. The frontend has a mirror for
instant feedback, but nothing reaches an extractor unless it passes here.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Callable
from urllib.parse import urlsplit, urlunsplit

from .errors import ApiError

MAX_URL_LENGTH = 2048


def _is(host: str, domain: str) -> bool:
    return host == domain or host.endswith("." + domain)


@dataclass(frozen=True)
class Classification:
    content_type: str
    needs_resolution: bool = False


@dataclass(frozen=True)
class Platform:
    id: str
    name: str
    matches_host: Callable[[str], bool]
    classify: Callable[[str, str, dict[str, list[str]]], Classification]
    # Exact yt-dlp extractor names (lowercase) allowed for this platform.
    # The generic extractor is never allowed, so yt-dlp can't be used to fetch arbitrary URLs.
    ytdlp_extractors: tuple[str, ...]
    # Platforms whose image posts can fall back to gallery-dl.
    gallerydl_fallback: bool = False
    # Hosts that are short links and must be resolved (with every hop validated) before extraction.
    short_link_hosts: tuple[str, ...] = ()
    # Every host a redirect from a short link may land on.
    redirect_hosts: Callable[[str], bool] = field(default=lambda h: False)


def _unsupported(msg: str) -> ApiError:
    return ApiError("unsupported_content", msg)


def _instagram(host: str, path: str, q: dict) -> Classification:
    if re.match(r"^/(stories|s)/", path):
        raise _unsupported("Instagram Stories require logging in, so they can't be downloaded. Use a public post or Reel link instead.")
    if re.match(r"^/([\w.]+/)?(reel|reels)/[\w-]+", path):
        return Classification("reel")
    if re.match(r"^/([\w.]+/)?tv/[\w-]+", path):
        return Classification("video")
    if re.match(r"^/([\w.]+/)?p/[\w-]+", path):
        return Classification("post")
    raise _unsupported("Paste the link of a specific Instagram post or Reel.")


def _tiktok(host: str, path: str, q: dict) -> Classification:
    if re.match(r"^/@[\w.-]+/video/\d+", path):
        return Classification("video")
    if re.match(r"^/@[\w.-]+/photo/\d+", path):
        return Classification("photo")
    if host.startswith(("vm.", "vt.")) or re.match(r"^/t/[\w-]+", path):
        return Classification("short_link", needs_resolution=True)
    raise _unsupported("Paste the link of a specific TikTok video or photo post.")


def _youtube(host: str, path: str, q: dict) -> Classification:
    if host == "youtu.be" and re.match(r"^/[\w-]{6,}$", path):
        return Classification("video")
    if re.match(r"^/shorts/[\w-]+", path):
        return Classification("short")
    if path == "/watch" and q.get("v"):
        return Classification("video")
    if re.match(r"^/(live|embed|v)/[\w-]+", path):
        return Classification("video")
    if path == "/playlist":
        raise _unsupported("Playlists aren't supported. Paste the link of an individual video.")
    raise _unsupported("Paste the link of a specific YouTube video or Short.")


def _facebook(host: str, path: str, q: dict) -> Classification:
    if host == "fb.watch":
        return Classification("video", needs_resolution=True)
    if re.match(r"^/share/[rv]/", path):
        return Classification("reel" if "/r/" in path else "video", needs_resolution=True)
    if re.search(r"/reel/\d+", path):
        return Classification("reel")
    if "/videos/" in path or (path == "/watch" and q.get("v")):
        return Classification("video")
    raise _unsupported("Paste the link of a specific public Facebook video or Reel.")


def _x(host: str, path: str, q: dict) -> Classification:
    if re.match(r"^/(\w+|i(/web)?)/status/\d+", path):
        return Classification("post")
    raise _unsupported("Paste the link of a specific post that contains a video, GIF or images.")


def _pinterest(host: str, path: str, q: dict) -> Classification:
    if host == "pin.it":
        return Classification("pin", needs_resolution=True)
    if re.match(r"^/pin/[\w-]+", path):
        return Classification("pin")
    raise _unsupported("Paste the link of a specific pin.")


def _reddit(host: str, path: str, q: dict) -> Classification:
    if host in ("v.redd.it", "redd.it"):
        return Classification("post", needs_resolution=True)
    if re.match(r"^/r/\w+/s/\w+", path):
        return Classification("post", needs_resolution=True)
    if re.search(r"/comments/\w+", path):
        return Classification("post")
    raise _unsupported("Paste the link of a specific Reddit post.")


def _vimeo(host: str, path: str, q: dict) -> Classification:
    if re.match(r"^/(\d+|channels/[\w-]+/\d+|video/\d+|[\w-]+/[\w-]+/video/\d+)", path):
        return Classification("video")
    raise _unsupported("Paste the link of a specific Vimeo video.")


_PINTEREST_HOST = re.compile(r"(^|\.)pinterest\.(com|co\.uk|ca|com\.au|de|fr|es|it|jp|com\.mx|ph|nz|ie|at|ch|pt|se|dk|cl)$")

PLATFORMS: dict[str, Platform] = {p.id: p for p in [
    Platform("instagram", "Instagram", lambda h: _is(h, "instagram.com"), _instagram, ("instagram",), gallerydl_fallback=True),
    Platform("tiktok", "TikTok", lambda h: _is(h, "tiktok.com"), _tiktok, ("tiktok", "vm.tiktok"),
             short_link_hosts=("vm.tiktok.com", "vt.tiktok.com"), redirect_hosts=lambda h: _is(h, "tiktok.com")),
    Platform("youtube", "YouTube", lambda h: _is(h, "youtube.com") or h == "youtu.be", _youtube, ("youtube",)),
    Platform("facebook", "Facebook", lambda h: _is(h, "facebook.com") or h == "fb.watch", _facebook, ("facebook", "facebook:reel"),
             short_link_hosts=("fb.watch", "www.facebook.com", "facebook.com", "m.facebook.com"),
             redirect_hosts=lambda h: _is(h, "facebook.com") or h == "fb.watch"),
    Platform("x", "X (Twitter)", lambda h: _is(h, "x.com") or _is(h, "twitter.com"), _x, ("twitter",), gallerydl_fallback=True),
    Platform("pinterest", "Pinterest", lambda h: bool(_PINTEREST_HOST.search(h)) or h == "pin.it", _pinterest, ("pinterest",),
             gallerydl_fallback=True, short_link_hosts=("pin.it",), redirect_hosts=lambda h: bool(_PINTEREST_HOST.search(h)) or h == "pin.it"),
    Platform("reddit", "Reddit", lambda h: _is(h, "reddit.com") or h in ("redd.it", "v.redd.it"), _reddit, ("reddit",),
             gallerydl_fallback=True, short_link_hosts=("redd.it", "v.redd.it", "www.reddit.com", "reddit.com"),
             redirect_hosts=lambda h: _is(h, "reddit.com") or h in ("redd.it", "v.redd.it")),
    Platform("vimeo", "Vimeo", lambda h: _is(h, "vimeo.com"), _vimeo, ("vimeo",)),
]}


@dataclass(frozen=True)
class ParsedUrl:
    url: str
    host: str
    path: str
    platform: Platform
    classification: Classification


def parse_media_url(raw: object) -> ParsedUrl:
    """Validate a user-supplied URL and match it to a platform. Raises ApiError."""
    if not isinstance(raw, str) or not raw.strip():
        raise ApiError("invalid_request", "Paste a link first.")
    raw = raw.strip()
    if len(raw) > MAX_URL_LENGTH:
        raise ApiError("invalid_request", "That link is too long.")
    if any(ord(c) < 0x21 or ord(c) == 0x7F for c in raw):
        raise ApiError("invalid_request", "That link contains invalid characters.")
    if not re.match(r"^https?://", raw, re.I):
        if re.match(r"^[a-z][a-z0-9+.-]*:", raw, re.I) and not re.match(r"^[\w.-]+\.[a-z]{2,}(:\d+)?(/|$)", raw, re.I):
            raise ApiError("unsafe_url", "Only http and https links are supported.")
        raw = "https://" + raw
    try:
        parts = urlsplit(raw)
        port = parts.port
    except ValueError:
        raise ApiError("invalid_request", "That doesn't look like a valid link.") from None
    if parts.scheme.lower() not in ("http", "https"):
        raise ApiError("unsafe_url", "Only http and https links are supported.")
    if parts.username or parts.password or "@" in parts.netloc:
        raise ApiError("unsafe_url")
    if port not in (None, 80, 443):
        raise ApiError("unsafe_url")
    host = (parts.hostname or "").lower().rstrip(".")
    try:
        host.encode("ascii")
    except UnicodeEncodeError:
        raise ApiError("unsupported_url") from None
    if not host or "." not in host or re.match(r"^[\d.]+$", host) or ":" in host:
        raise ApiError("unsafe_url")
    platform = next((p for p in PLATFORMS.values() if p.matches_host(host)), None)
    if platform is None:
        raise ApiError("unsupported_url", f"{host} isn't a supported platform. Supported: Instagram, TikTok, YouTube, Facebook, X, Pinterest, Reddit and Vimeo.")
    path = re.sub(r"/+$", "", parts.path) or "/"
    query: dict[str, list[str]] = {}
    for kv in parts.query.split("&"):
        if "=" in kv:
            k, v = kv.split("=", 1)
            query.setdefault(k, []).append(v)
    try:
        cls = platform.classify(host, path, query)
    except ApiError as e:
        e.platform = platform.id
        raise
    # Normalise: https, no fragment, no credentials, default port.
    url = urlunsplit(("https", host, parts.path or "/", parts.query, ""))
    return ParsedUrl(url=url, host=host, path=path, platform=platform, classification=cls)
