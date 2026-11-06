"""Resolve platform short links (pin.it, vm.tiktok.com, fb.watch, redd.it, …).

Redirects are followed manually so that every hop is checked: it must stay
on HTTPS, on the same platform's allowlisted hosts, and resolve to public IPs.
This is the only place the API process itself makes outbound requests.
"""
from __future__ import annotations

from urllib.parse import urljoin, urlsplit

import httpx

from .errors import ApiError
from .netguard import BlockedAddressError, check_public_host
from .platforms import ParsedUrl, parse_media_url

MAX_HOPS = 5
USER_AGENT = "Mozilla/5.0 (compatible; YoniXTools/1.0; +https://yonixtools.com)"


async def resolve_short_link(parsed: ParsedUrl, client: httpx.AsyncClient | None = None, timeout: float = 8.0) -> ParsedUrl:
    if not parsed.classification.needs_resolution:
        return parsed
    platform = parsed.platform
    own = client is None
    client = client or httpx.AsyncClient(follow_redirects=False, timeout=timeout, headers={"user-agent": USER_AGENT}, trust_env=False)
    try:
        url = parsed.url
        for _ in range(MAX_HOPS):
            parts = urlsplit(url)
            host = (parts.hostname or "").lower()
            if parts.scheme != "https" or not (platform.redirect_hosts(host) or platform.matches_host(host)):
                raise ApiError("unsafe_url", "The link redirected somewhere unexpected.", platform.id)
            try:
                check_public_host(host)
            except BlockedAddressError:
                raise ApiError("unsafe_url", platform=platform.id) from None
            try:
                resp = await client.get(url)
            except httpx.TimeoutException:
                raise ApiError("timeout", platform=platform.id) from None
            except (httpx.HTTPError, OSError):
                raise ApiError("platform_blocked", platform=platform.id) from None
            await resp.aclose()
            if resp.status_code in (301, 302, 303, 307, 308) and resp.headers.get("location"):
                url = urljoin(url, resp.headers["location"])
                nxt = urlsplit(url)
                nhost = (nxt.hostname or "").lower()
                if nxt.scheme != "https" or not (platform.redirect_hosts(nhost) or platform.matches_host(nhost)):
                    raise ApiError("unsafe_url", "The link redirected somewhere unexpected.", platform.id)
                candidate = _try_parse(url)
                if candidate and candidate.platform.id == platform.id and not candidate.classification.needs_resolution:
                    return candidate
                continue
            if resp.status_code == 404:
                raise ApiError("unavailable", platform=platform.id)
            if resp.status_code >= 400:
                raise ApiError("platform_blocked", platform=platform.id)
            candidate = _try_parse(str(resp.url))
            if candidate and not candidate.classification.needs_resolution:
                return candidate
            # Final page is on the platform but not a recognisable media URL:
            # let the platform's own yt-dlp extractor handle the short link.
            return parsed
        raise ApiError("unsafe_url", "The link redirected too many times.", platform.id)
    finally:
        if own:
            await client.aclose()


def _try_parse(url: str) -> ParsedUrl | None:
    try:
        return parse_media_url(url)
    except ApiError:
        return None
