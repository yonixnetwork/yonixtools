"""Error codes shared by the API, the worker and the frontend client.

User-facing messages never contain stack traces, server paths or raw
extractor output.
"""
from __future__ import annotations

ERROR_STATUS: dict[str, int] = {
    "invalid_request": 400,
    "unsupported_url": 422,
    "unsupported_content": 422,
    "unsafe_url": 422,
    "unavailable": 422,
    "private": 422,
    "login_required": 422,
    "age_restricted": 422,
    "geo_blocked": 422,
    "drm_protected": 422,
    "live_stream": 422,
    "too_large": 422,
    "too_long": 422,
    "no_media": 422,
    "invalid_format": 422,
    "not_found": 404,
    "expired": 410,
    "payload_too_large": 413,
    "rate_limited": 429,
    "busy": 503,
    "platform_blocked": 502,
    "network_error": 502,
    "extractor_failed": 502,
    "timeout": 504,
    "server_error": 500,
}

DEFAULT_MESSAGES: dict[str, str] = {
    "invalid_request": "The request was not valid.",
    "unsupported_url": "This link isn't from a supported platform.",
    "unsupported_content": "This kind of link isn't supported.",
    "unsafe_url": "This link points to an address that can't be used.",
    "unavailable": "This content is unavailable. It may have been deleted or the link may be wrong.",
    "private": "This content is private, so it can't be downloaded.",
    "login_required": "This content requires logging in, so it can't be downloaded.",
    "age_restricted": "This content is age-restricted and requires logging in, so it can't be downloaded.",
    "geo_blocked": "This content isn't available in the server's region.",
    "drm_protected": "This content is DRM-protected and can't be downloaded.",
    "live_stream": "Live streams can't be downloaded. Try again after the stream has ended.",
    "too_large": "This file is larger than the download limit.",
    "too_long": "This video is longer than the download limit.",
    "no_media": "No downloadable media was found in this post.",
    "invalid_format": "That format isn't available for this content.",
    "not_found": "That download doesn't exist.",
    "expired": "This download has expired. Please start it again.",
    "payload_too_large": "The request is too large.",
    "rate_limited": "Too many requests. Please wait a minute and try again.",
    "busy": "The downloader is busy right now. Please try again in a minute.",
    "platform_blocked": "The platform is temporarily refusing requests from our server. Please try again later.",
    "network_error": "We couldn't reach the platform. Please try again later.",
    "extractor_failed": "We couldn't read this post. The platform may have changed something on its side.",
    "timeout": "This took too long and was stopped. Please try again.",
    "server_error": "Something went wrong on our side. Nothing was downloaded.",
}


# More precise wording where a platform's failure has a known cause.
PLATFORM_MESSAGES: dict[tuple[str, str], str] = {
    ("youtube", "platform_blocked"): "YouTube is asking our server to sign in to prove it isn't a bot, so YouTube downloads are blocked from our server right now. "
                                     "We don't use accounts or cookies. Other platforms are not affected.",
    ("youtube", "login_required"): "YouTube requires signing in for this video, so it can't be downloaded.",
    ("reddit", "login_required"): "Reddit is refusing anonymous requests from our server right now, so Reddit downloads aren't working. We don't use accounts.",
    ("reddit", "platform_blocked"): "Reddit is refusing requests from our server right now. Please try again later.",
    ("vimeo", "login_required"): "Vimeo only serves this video to signed-in users or blocks its embed player, so it can't be downloaded. Public, embeddable Vimeo videos work.",
    ("facebook", "extractor_failed"): "Facebook didn't give us this video. It may be private, removed, only visible to logged-in users, or limited to some regions.",
    ("facebook", "login_required"): "Facebook only shows this video to logged-in users, so it can't be downloaded.",
    ("instagram", "login_required"): "Instagram only shows this post to logged-in users (or it is from a private account), so it can't be downloaded.",
    ("instagram", "platform_blocked"): "Instagram is rate-limiting our server right now. Please try again in a few minutes.",
    ("tiktok", "geo_blocked"): "TikTok doesn't make this post available in our server's region.",
    ("x", "login_required"): "X only shows this post to logged-in users (it may be marked sensitive or protected), so it can't be downloaded.",
}


def message_for(code: str, platform: str | None) -> str:
    return PLATFORM_MESSAGES.get((platform or "", code)) or DEFAULT_MESSAGES.get(code) or DEFAULT_MESSAGES["server_error"]


class ApiError(Exception):
    def __init__(self, code: str, message: str | None = None, platform: str | None = None, status: int | None = None):
        if code not in ERROR_STATUS:
            code = "server_error"
        self.code = code
        self.message = message or DEFAULT_MESSAGES[code]
        self.platform = platform
        self.status = status or ERROR_STATUS[code]
        super().__init__(self.message)

    def body(self) -> dict:
        err: dict = {"code": self.code, "message": self.message}
        if self.platform:
            err["platform"] = self.platform
        return {"error": err}
