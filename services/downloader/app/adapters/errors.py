"""Map raw extractor error text to stable error codes (never shown to users)."""
from __future__ import annotations

import re

_RULES: list[tuple[str, str]] = [
    (r"private (video|account|post)|this account is private|is private", "private"),
    (r"sign in to confirm your age|age[- ]restricted|inappropriate for some users", "age_restricted"),
    (r"sign in to confirm you.?re not a bot|confirm you are not a robot|captcha", "platform_blocked"),
    (r"login required|log in|requires? (authentication|login|cookies)|cookies|rate-limit reached|use --cookies", "login_required"),
    (r"drm", "drm_protected"),
    (r"not available in your country|geo.?restrict|blocked it in your country|ip address is blocked from accessing this post", "geo_blocked"),
    (r"is a live (event|stream)|live stream|is live|premieres in", "live_stream"),
    (r"failed to resolve|name or service not known|temporary failure in name resolution|network is unreachable|connection refused|connection reset|nodename nor servname", "network_error"),
    (r"http error 429|too many requests|rate.?limit", "platform_blocked"),
    (r"http error 403|forbidden", "platform_blocked"),
    (r"file is larger than max-filesize|max.?filesize|file size limit exceeded|filesize", "too_large"),
    (r"there is no video in this post|no video formats found|no media found|no formats", "no_media"),
    (r"video unavailable|this video (has been|is) (removed|unavailable|deleted)|not found|http error 404|does not exist|been removed|no longer available|unavailable|deleted", "unavailable"),
    (r"unsupported url|no suitable extractor", "unsupported_content"),
    (r"timed out|timeout", "timeout"),
    (r"refusing to connect to non-public|blockedaddress", "unsafe_url"),
    (r"unable to (download|extract)|unable to parse|failed to parse|keyerror|jsondecodeerror|extractorerror", "extractor_failed"),
]


def classify_error(message: str) -> str:
    text = (message or "").lower()
    for pattern, code in _RULES:
        if re.search(pattern, text):
            return code
    return "extractor_failed"


# Errors for which trying the next backend makes sense.
FALLBACK_CODES = {"no_media", "extractor_failed", "unsupported_content"}
