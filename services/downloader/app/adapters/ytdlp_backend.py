"""yt-dlp extraction backend.

Restricted to the platform's own extractors (never 'generic'), no cookies,
no logins, native HLS/DASH downloading (FFmpeg only merges local files).
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Callable

from ..media import MediaFormat, MediaInfo, MediaItem, split_format

HEIGHTS = (2160, 1440, 1080, 720, 480, 360, 240)
IMAGE_EXTS = {"jpg", "jpeg", "png", "webp", "gif", "avif"}
VIDEO_EXTS = {"mp4", "webm", "mov", "m4v", "mkv"}


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
            # Only for platforms whose format-less entries are images: elsewhere the
            # flag would turn real errors (e.g. YouTube's bot check) into "no media".
            image_posts = platform in IMAGE_POST_PLATFORMS
            with yt_dlp.YoutubeDL(self._opts(logger=logger, skip_download=True, ignore_no_formats_error=image_posts)) as ydl:
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
        sources: dict[str, dict] = {}
        for idx, e in enumerate(entries):
            if e.get("is_live") or e.get("live_status") in ("is_live", "is_upcoming"):
                raise BackendError("live_stream", "live")
            dur = e.get("duration")
            if dur and self.max_duration and dur > self.max_duration:
                raise BackendError("too_long", f"duration {dur}")
            item = self._item(idx, e, platform, sources)
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
            extra={"multi": len(entries) > 1, "sources": sources},
        )

    def _item(self, idx: int, e: dict, platform: str = "", sources: dict | None = None) -> MediaItem | None:
        formats = [f for f in (e.get("formats") or []) if not f.get("has_drm") and f.get("url") and not _is_storyboard(f)]
        if not formats and not e.get("url") and platform in IMAGE_POST_PLATFORMS:
            return self._image_item(idx, e, sources if sources is not None else {})
        if not formats and e.get("url"):
            formats = [{"url": e["url"], "ext": e.get("ext"), "vcodec": e.get("vcodec"), "acodec": e.get("acodec"),
                        "height": e.get("height"), "filesize": e.get("filesize")}]
        if not formats:
            return None
        videos = [f for f in formats if f.get("vcodec") not in (None, "none") or (f.get("height") and f.get("ext") not in IMAGE_EXTS)
                  or (f.get("vcodec") is None and str(f.get("ext") or "").lower() in VIDEO_EXTS)]
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
                out.append(MediaFormat("a:best", f"Audio only · {ext.upper()} (original)", ext, "audio", _size(a) or None))
                if ext != "mp3":
                    out.append(MediaFormat("a:mp3", "Audio only · MP3 (converted)", "mp3", "audio", None))
            elif any(f.get("acodec") not in (None, "none") for f in videos):
                # Audio known to be muxed inside the video: extract it with FFmpeg.
                # (Unknown audio is not offered: the post may be silent.)
                out.append(MediaFormat("a:mp3", "Audio only · MP3 (converted)", "mp3", "audio", None))
            return MediaItem(idx, "video", out, thumb, e.get("duration"), _int(e.get("width")), _int(e.get("height")))
        if audios:
            a = max(audios, key=lambda f: f.get("abr") or 0)
            ext = (a.get("ext") or "m4a").lower()
            opts = [MediaFormat("a:best", f"Audio · {ext.upper()} (original)", ext, "audio", _size(a) or None)]
            if ext != "mp3":
                opts.append(MediaFormat("a:mp3", "Audio · MP3 (converted)", "mp3", "audio", None))
            return MediaItem(idx, "audio", opts, thumb, e.get("duration"))
        if images:
            best = max(images, key=lambda f: (f.get("width") or 0) * (f.get("height") or 0))
            ext = (best.get("ext") or "jpg").lower()
            return MediaItem(idx, "image", [MediaFormat("i:best", f"Original image · {ext.upper()}", ext, "image", _size(best) or None)], thumb or _https(best.get("url")))
        f0 = formats[0]
        return MediaItem(idx, "video", [MediaFormat("f:best", f"Original · {(f0.get('ext') or 'file').upper()}", f0.get("ext") or "mp4", "video", _size(f0) or None)], thumb, e.get("duration"))

    def _image_item(self, idx: int, e: dict, sources: dict) -> MediaItem | None:
        """A post/carousel image. Size choices are offered only when the platform
        really provides several copies (never invented); otherwise "Original"."""
        thumbs = [t for t in (e.get("thumbnails") or []) if _https(t.get("url"))]
        if not thumbs:
            return None
        sized: list[tuple[int, int, str]] = []
        for t in thumbs:
            w, h = _int(t.get("width")), _int(t.get("height"))
            if w and h and not any(c[0] == w for c in sized):
                sized.append((w, h, t["url"]))
        headers = _safe_headers(e.get("http_headers"))
        out: list[MediaFormat] = []
        if sized:
            sized.sort(reverse=True)
            for n, (w, h, u) in enumerate(sized[:4]):
                fid = "i:best" if n == 0 else f"i:{w}"
                ext = _image_ext(u)
                label = f"Original · {w}×{h} · {ext.upper()}" if n == 0 else f"{w}×{h} · {ext.upper()} (smaller copy from {e.get('extractor_key') or 'the platform'})"
                out.append(MediaFormat(fid, label, ext, "image", None))
                sources[f"{idx}:{fid}"] = {"url": u, "headers": headers}
            w, h, _ = sized[0]
            preview = min(sized, key=lambda c: abs(c[0] - 480))[2]
        else:
            # yt-dlp orders thumbnails by preference: the last one is the best copy.
            u = thumbs[-1]["url"]
            w, h = _int(e.get("width")), _int(e.get("height"))
            ext = _image_ext(u)
            dims = f" · {w}×{h}" if w and h else ""
            out.append(MediaFormat("i:best", f"Original{dims} · {ext.upper()}", ext, "image", None))
            sources[f"{idx}:i:best"] = {"url": u, "headers": headers}
            preview = u
        return MediaItem(idx, "image", out, preview, None, w, h)

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
        if format_id == "a:mp3":
            return "ba/b"
        return "b/best"

    def download(self, url: str, item_index: int, format_id: str, out_dir: Path, multi: bool, progress: Callable[[float | None, int | None, int | None], None],
                 source: dict | None = None) -> Path:
        base, conv = split_format(format_id)
        if base.startswith("i:") and source:
            # Image found during extraction: fetch exactly that file (no second platform request).
            path = fetch_source(source, out_dir / "media", self.max_filesize, progress)
            return convert_image(path, conv, progress) if conv else path
        path = self._ytdlp_download(url, item_index, base, out_dir, multi, progress)
        return convert_image(path, conv, progress) if conv else path

    def _ytdlp_download(self, url: str, item_index: int, format_id: str, out_dir: Path, multi: bool,
                        progress: Callable[[float | None, int | None, int | None], None]) -> Path:
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
            postprocessors=[{"key": "FFmpegExtractAudio", "preferredcodec": "mp3", "preferredquality": "192"}] if format_id == "a:mp3" else None,
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


IMAGE_POST_PLATFORMS = {"instagram"}  # yt-dlp lists their carousel images as format-less entries with size candidates
_SAFE_HEADERS = ("User-Agent", "Referer", "Accept", "Accept-Language")


def _int(v: object) -> int | None:
    try:
        return int(v) if v is not None else None  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None


def _safe_headers(h: object) -> dict:
    if not isinstance(h, dict):
        return {}
    return {k: str(v)[:400] for k, v in h.items() if k in _SAFE_HEADERS and isinstance(v, str)}


def _image_ext(u: str) -> str:
    m = re.search(r"\.(jpe?g|png|webp|gif|avif|heic)(?:$|[?#])", u.split("?")[0] + "?", re.I)
    ext = (m.group(1).lower() if m else "jpg")
    return "jpg" if ext == "jpeg" else ext


def fetch_source(source: dict, dest_stem: Path, max_bytes: int, progress: Callable | None = None) -> Path:
    """Download one media URL that an extractor reported (https only, size-capped).

    Runs inside the worker, so the socket guard blocks private/internal
    addresses on every connection, including each redirect hop.
    """
    import urllib.request

    url = source.get("url")
    if not isinstance(url, str) or not url.startswith("https://"):
        raise BackendError("unsafe_url", "source must be https")

    class HttpsOnly(urllib.request.HTTPRedirectHandler):
        max_redirections = 4

        def redirect_request(self, req, fp, code, msg, hdrs, newurl):  # type: ignore[override]
            if not str(newurl).startswith("https://"):
                raise BackendError("unsafe_url", "redirect to non-https")
            return super().redirect_request(req, fp, code, msg, hdrs, newurl)

    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36",
               **_safe_headers(source.get("headers"))}
    opener = urllib.request.build_opener(HttpsOnly())
    try:
        with opener.open(urllib.request.Request(url, headers=headers), timeout=30) as r:
            total = int(r.headers.get("Content-Length") or 0) or None
            if total and total > max_bytes:
                raise BackendError("too_large", "source larger than limit")
            ctype = (r.headers.get("Content-Type") or "").split(";")[0].strip().lower()
            ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif", "image/heic": "heic",
                   "video/mp4": "mp4", "audio/mp4": "m4a", "audio/mpeg": "mp3"}.get(ctype) or _image_ext(url)
            path = dest_stem.with_suffix("." + ext)
            done = 0
            with open(path, "wb") as f:
                while chunk := r.read(256 * 1024):
                    done += len(chunk)
                    if done > max_bytes:
                        raise BackendError("too_large", "source larger than limit")
                    f.write(chunk)
                    if progress:
                        progress(done / total * 100 if total else None, done, total)
    except BackendError:
        raise
    except Exception as e:
        raise BackendError("raw", f"source fetch failed: {e}"[:300]) from None
    if done == 0:
        raise BackendError("no_media", "empty source")
    return path


def convert_image(path: Path, target: str, progress: Callable | None = None) -> Path:
    """Re-encode an image with FFmpeg only when the user asked for another format."""
    import subprocess

    target = {"jpeg": "jpg"}.get(target, target)
    if target not in ("jpg", "png", "webp"):
        raise BackendError("invalid_format", "conversion")
    if path.suffix.lower().lstrip(".").replace("jpeg", "jpg") == target:
        return path
    if progress:
        progress(-1, None, None)
    out = path.with_name(f"media-converted.{target}")
    args = ["ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-i", str(path), "-frames:v", "1"]
    args += {"jpg": ["-q:v", "2"], "png": [], "webp": ["-quality", "90"]}[target]
    proc = subprocess.run(args + [str(out)], capture_output=True, timeout=120, check=False)
    if proc.returncode != 0 or not out.is_file() or out.stat().st_size == 0:
        raise BackendError("raw", "image conversion failed: " + proc.stderr.decode("utf-8", "replace")[-300:])
    path.unlink(missing_ok=True)
    final = path.with_name(f"media.{target}")
    out.rename(final)
    return final


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
