"""yt-dlp extraction backend.

Restricted to the platform's own extractors (never 'generic'), no cookies,
no logins, native HLS/DASH downloading (FFmpeg only merges local files).
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Callable

from ..media import MediaFormat, MediaInfo, MediaItem

HEIGHTS = (2160, 1440, 1080, 720, 480, 360, 240)
IMAGE_EXTS = {"jpg", "jpeg", "png", "webp", "gif", "avif"}


class BackendError(Exception):
    def __init__(self, code: str, detail: str = ""):
        super().__init__(detail or code)
        self.code = code
        self.detail = detail


class _QuietLogger:
    """Collects yt-dlp messages for error classification; nothing is printed."""

    SIGNIFICANT = ("max-filesize", "larger than", "drm", "live", "private", "login", "unavailable")

    def __init__(self) -> None:
        self.errors: list[str] = []

    def _note(self, msg: str) -> None:
        m = str(msg)
        if any(k in m.lower() for k in self.SIGNIFICANT):
            self.errors.append(m[:500])
            del self.errors[:-20]

    def debug(self, msg: str) -> None:
        self._note(msg)

    def info(self, msg: str) -> None:
        self._note(msg)

    def warning(self, msg: str) -> None:
        self._note(msg)

    def error(self, msg: str) -> None:
        self.errors.append(str(msg)[:500])
        del self.errors[:-20]


class YtDlpBackend:
    name = "yt-dlp"
    fallback_codes: set[str] | None = None  # None: the chain's default

    def __init__(self, extractors: tuple[str, ...], max_filesize: int, max_duration: int, max_items: int, socket_timeout: int = 20):
        self.extractors = [re.escape(e.lower()) for e in extractors]
        self.max_filesize = max_filesize
        self.max_duration = max_duration
        self.max_items = max_items
        self.socket_timeout = socket_timeout

    def _opts(self, **extra: Any) -> dict:
        opts = {
            "quiet": True,
            "no_warnings": True,
            "noprogress": True,
            "logger": _QuietLogger(),
            "allowed_extractors": self.extractors,
            "noplaylist": True,
            "cachedir": False,
            "socket_timeout": self.socket_timeout,
            "retries": 2,
            "fragment_retries": 3,
            "extractor_retries": 1,
            "hls_prefer_native": True,
            "concurrent_fragment_downloads": 1,
            "max_filesize": self.max_filesize,
            "playlistend": self.max_items,
            "lazy_playlist": False,
            "check_formats": False,
            "noplaylist_warning": False,
            "geo_bypass": False,
            "mark_watched": False,
            "writesubtitles": False,
            "writethumbnail": False,
            "restrictfilenames": True,
            "windowsfilenames": True,
        }
        opts.update(extra)
        return opts

    # ── extraction ────────────────────────────────────────────────────────
    def extract(self, url: str, platform: str) -> MediaInfo:
        import yt_dlp

        logger = _QuietLogger()
        try:
            with yt_dlp.YoutubeDL(self._opts(logger=logger, skip_download=True)) as ydl:
                info = ydl.extract_info(self.target(url), download=False)
        except Exception as e:  # yt-dlp raises DownloadError/ExtractorError subclasses
            raise BackendError("raw", " | ".join(logger.errors) or str(e)) from None
        if not info:
            raise BackendError("no_media", "empty info")
        return self.to_media(info, platform)

    def target(self, url: str) -> str:
        """The URL handed to yt-dlp (subclasses may rewrite it)."""
        return url

    def to_media(self, info: dict, platform: str) -> MediaInfo:
        entries = [e for e in (info.get("entries") or []) if e] if info.get("_type") in ("playlist", "multi_video") else [info]
        entries = entries[: self.max_items]
        if not entries:
            raise BackendError("no_media", "no entries")
        items: list[MediaItem] = []
        for idx, e in enumerate(entries):
            if e.get("is_live") or e.get("live_status") in ("is_live", "is_upcoming"):
                raise BackendError("live_stream", "live")
            dur = e.get("duration")
            if dur and self.max_duration and dur > self.max_duration:
                raise BackendError("too_long", f"duration {dur}")
            item = self._item(idx, e)
            if item:
                items.append(item)
        if not items:
            if any(f.get("has_drm") for e in entries for f in (e.get("formats") or [])):
                raise BackendError("drm_protected", "drm")
            raise BackendError("no_media", "no usable formats")
        first = entries[0]
        title = (info.get("title") or first.get("title") or first.get("description") or "Untitled").strip()
        return MediaInfo(
            platform=platform,
            backend=self.name,
            title=_clean(title, 200),
            author=_clean(info.get("uploader") or first.get("uploader") or first.get("channel") or "", 100) or None,
            thumbnail=_https(info.get("thumbnail") or first.get("thumbnail")),
            duration_seconds=first.get("duration") if len(items) == 1 else None,
            items=items,
            extra={"multi": len(entries) > 1},
        )

    def _item(self, idx: int, e: dict) -> MediaItem | None:
        formats = [f for f in (e.get("formats") or []) if not f.get("has_drm") and f.get("url") and not _is_storyboard(f)]
        if not formats and e.get("url"):
            formats = [{"url": e["url"], "ext": e.get("ext"), "vcodec": e.get("vcodec"), "acodec": e.get("acodec"),
                        "height": e.get("height"), "filesize": e.get("filesize")}]
        if not formats:
            return None
        videos = [f for f in formats if f.get("vcodec") not in (None, "none") or (f.get("height") and f.get("ext") not in IMAGE_EXTS)]
        audios = [f for f in formats if f.get("acodec") not in (None, "none") and f.get("vcodec") in (None, "none")]
        images = [f for f in formats if (f.get("ext") or "").lower() in IMAGE_EXTS]
        out: list[MediaFormat] = []
        thumb = _https(e.get("thumbnail"))
        if videos:
            heights = sorted({int(f["height"]) for f in videos if f.get("height")}, reverse=True)
            best_audio = _size(max(audios, key=lambda f: f.get("abr") or 0)) if audios else 0
            def size_for(h: int | None) -> int | None:
                cands = [f for f in videos if not h or (f.get("height") or 0) <= h]
                if not cands:
                    return None
                best = max(cands, key=lambda f: ((f.get("height") or 0), f.get("tbr") or 0))
                s = _size(best)
                return (s + (best_audio if best.get("acodec") in (None, "none") else 0)) if s else None
            top = heights[0] if heights else None
            marked = [f for f in videos if _watermarked(f)]
            clean = [f for f in videos if not _watermarked(f)]
            # Only claim "no watermark" when the platform really offers a clean source.
            wm = " · no watermark" if (marked and clean) else (" · watermarked" if marked and not clean else "")
            out.append(MediaFormat("v:best", f"Best quality{f' ({top}p)' if top else ''} · MP4{wm}", "mp4", "video", size_for(None)))
            # Offer standard rungs below the top resolution that actually exist (±10%).
            rungs = [h for h in HEIGHTS if top and h < top and any(abs(x - h) <= max(16, h * 0.1) for x in heights)][:4]
            seen_sizes = {out[0].filesize}
            for h in rungs:
                s = size_for(h)
                if s and s in seen_sizes:  # same underlying file as a higher rung: not a real choice
                    continue
                seen_sizes.add(s)
                out.append(MediaFormat(f"v:{h}", f"{h}p · MP4", "mp4", "video", s))
            if audios:
                a = max(audios, key=lambda f: f.get("abr") or 0)
                ext = "m4a" if any((f.get("ext") == "m4a") for f in audios) else (a.get("ext") or "webm")
                out.append(MediaFormat("a:best", f"Audio only · {ext.upper()}", ext, "audio", _size(a) or None))
            return MediaItem(idx, "video", out, thumb, e.get("duration"))
        if audios:
            a = max(audios, key=lambda f: f.get("abr") or 0)
            return MediaItem(idx, "audio", [MediaFormat("a:best", f"Audio · {(a.get('ext') or 'audio').upper()}", a.get("ext") or "m4a", "audio", _size(a) or None)], thumb, e.get("duration"))
        if images:
            best = max(images, key=lambda f: (f.get("width") or 0) * (f.get("height") or 0))
            ext = (best.get("ext") or "jpg").lower()
            return MediaItem(idx, "image", [MediaFormat("i:best", f"Original image · {ext.upper()}", ext, "image", _size(best) or None)], thumb or _https(best.get("url")))
        f0 = formats[0]
        return MediaItem(idx, "video", [MediaFormat("f:best", f"Original · {(f0.get('ext') or 'file').upper()}", f0.get("ext") or "mp4", "video", _size(f0) or None)], thumb, e.get("duration"))

    # ── download ──────────────────────────────────────────────────────────
    @staticmethod
    def selector(format_id: str) -> str:
        if format_id == "v:best":
            # Prefer sources without a watermark when the platform offers one (e.g. TikTok).
            return ("bv*[ext=mp4][format_note!*=watermark]+ba[ext=m4a]/bv*[format_note!*=watermark]+ba/b[format_note!*=watermark]"
                    "/bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b")
        if format_id.startswith("v:"):
            h = int(format_id[2:])
            return f"bv*[height<={h}][ext=mp4]+ba[ext=m4a]/bv*[height<={h}]+ba/b[height<={h}]/b"
        if format_id == "a:best":
            return "ba[ext=m4a]/ba"
        return "b/best"

    def download(self, url: str, item_index: int, format_id: str, out_dir: Path, multi: bool, progress: Callable[[float | None, int | None, int | None], None]) -> Path:
        import yt_dlp

        def hook(d: dict) -> None:
            if d.get("status") == "downloading":
                total = d.get("total_bytes") or d.get("total_bytes_estimate")
                done = d.get("downloaded_bytes")
                pct = (done / total * 100) if (total and done is not None) else None
                progress(pct, done, total)

        logger = _QuietLogger()
        opts = self._opts(
            logger=logger,
            format=self.selector(format_id),
            outtmpl={"default": "media.%(ext)s"},
            paths={"home": str(out_dir), "temp": str(out_dir)},
            merge_output_format="mp4" if format_id.startswith("v:") else None,
            progress_hooks=[hook],
            postprocessor_hooks=[lambda d: d.get("status") == "started" and progress(-1, None, None)],
            noplaylist=not multi,
            playlist_items=str(item_index + 1) if multi else None,
            overwrites=True,
            nopart=False,
            updatetime=False,
        )
        try:
            with yt_dlp.YoutubeDL({k: v for k, v in opts.items() if v is not None}) as ydl:
                # Same as ydl.download(), but DRM-flagged formats are removed
                # before format selection so a selector can never land on one
                # (seen with Vimeo's player config).
                info = ydl.extract_info(self.target(url), download=False, process=False)
                ydl.process_ie_result(_strip_unusable(info), download=True)
                code = ydl._download_retcode
        except Exception as e:
            raise BackendError("raw", " | ".join(logger.errors) or str(e)) from None
        files = [p for p in out_dir.iterdir() if p.is_file() and p.name.startswith("media.") and not p.name.endswith((".part", ".ytdl")) and ".f" not in p.suffixes[:-1]]
        if code or not files:
            raise BackendError("raw", " | ".join(logger.errors) or "download produced no file")
        return max(files, key=lambda p: p.stat().st_size)


class VimeoPlayerBackend(YtDlpBackend):
    """Vimeo through the public embed player (player.vimeo.com) instead of the API.

    The URL is rebuilt from the validated numeric id (and unlisted hash), so
    nothing user-controlled besides those reaches yt-dlp.
    """

    name = "yt-dlp-player"

    def target(self, url: str) -> str:
        m = re.search(r"vimeo\.com/(?:.*?/)?(?:video/)?(\d{3,12})(?:/([0-9a-f]{6,20}))?(?:[/?#]|$)", url)
        if not m:
            raise BackendError("unsupported_content", "no vimeo id")
        h = m.group(2) or (re.search(r"[?&]h=([0-9a-f]{6,20})", url) or [None, None])[1]
        return f"https://player.vimeo.com/video/{m.group(1)}" + (f"?h={h}" if h else "")


def _strip_unusable(info: Any) -> Any:
    """Drop DRM-protected formats (and storyboards) from an extractor result, in place."""
    if not isinstance(info, dict):
        return info
    if isinstance(info.get("formats"), list):
        info["formats"] = [f for f in info["formats"] if not f.get("has_drm") and not _is_storyboard(f)]
    entries = info.get("entries")
    if isinstance(entries, list):
        for e in entries:
            _strip_unusable(e)
    return info


def _is_storyboard(f: dict) -> bool:
    """YouTube storyboards (thumbnail sprites) look like low-res video formats."""
    return f.get("protocol") == "mhtml" or "storyboard" in str(f.get("format_note") or "").lower() or str(f.get("format_id") or "").startswith("sb")


def _watermarked(f: dict) -> bool:
    return "watermark" in str(f.get("format_note") or "").lower()


def _size(f: dict) -> int:
    return int(f.get("filesize") or f.get("filesize_approx") or 0)


def _https(u: object) -> str | None:
    return u if isinstance(u, str) and u.startswith("https://") and len(u) < 2048 else None


def _clean(s: str, n: int) -> str:
    s = re.sub(r"[\x00-\x1f\x7f]+", " ", str(s)).strip()
    return s[: n - 1] + "…" if len(s) > n else s
