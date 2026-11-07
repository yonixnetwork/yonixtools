"""Platform adapter = an ordered chain of extraction backends.

Swapping or adding an extractor for one platform only touches this mapping.
"""
from __future__ import annotations

from pathlib import Path
from typing import Callable

from ..media import MediaInfo, split_format
from ..platforms import Platform
from .errors import FALLBACK_CODES, classify_error
from .gallerydl_backend import GalleryDlBackend
from .ytdlp_backend import BackendError, YtDlpBackend


class ExtractionFailed(Exception):
    def __init__(self, code: str, backend: str, detail: str):
        super().__init__(detail)
        self.code = code
        self.backend = backend
        self.detail = detail


def _code(e: BackendError) -> str:
    return classify_error(e.detail) if e.code == "raw" else e.code


def backends_for(platform: Platform, cfg: dict) -> list:
    chain: list = [YtDlpBackend(platform.ytdlp_extractors, cfg["max_filesize"], cfg["max_duration"], cfg["max_items"])]
    # Vimeo: an embed-player fallback was tried and rejected (live matrix runs
    # 3-4): it lists qualities but the streams are DRM-protected, so users
    # would see options that can never download. See docs/PLATFORM_DIAGNOSTICS.md.
    if platform.gallerydl_fallback or platform.id == "tiktok":
        chain.append(GalleryDlBackend(cfg["max_filesize"], cfg["max_items"], cfg["timeout"]))
    return chain


def extract(platform: Platform, url: str, cfg: dict, chain: list | None = None) -> MediaInfo:
    chain = chain if chain is not None else backends_for(platform, cfg)
    first: ExtractionFailed | None = None
    for backend in chain:
        try:
            return backend.extract(url, platform.id)
        except BackendError as e:
            failure = ExtractionFailed(_code(e), backend.name, e.detail[:800])
            first = first or failure
            if failure.code not in (getattr(backend, "fallback_codes", None) or FALLBACK_CODES):
                raise failure from None
    # Report the first backend's error: it is usually the most specific.
    assert first is not None
    raise first


def _backend(platform: Platform, backend_name: str, cfg: dict, chain: list | None):
    chain = chain if chain is not None else backends_for(platform, cfg)
    backend = next((b for b in chain if b.name == backend_name), None)
    if backend is None:
        raise ExtractionFailed("invalid_format", backend_name, "backend not available for platform")
    return backend


def download(platform: Platform, url: str, backend_name: str, item_index: int, format_id: str, out_dir: Path, multi: bool,
             cfg: dict, progress: Callable[[float | None, int | None, int | None], None], chain: list | None = None,
             source: dict | None = None) -> Path:
    backend = _backend(platform, backend_name, cfg, chain)
    base, conv = split_format(format_id)
    try:
        if isinstance(backend, GalleryDlBackend):
            return backend.download(url, int(base.split(":")[1]), out_dir, cfg["timeout"], conv)
        return backend.download(url, item_index, format_id, out_dir, multi, progress, source)
    except BackendError as e:
        raise ExtractionFailed(_code(e), backend.name, e.detail[:800]) from None


def download_zip(platform: Platform, url: str, backend_name: str, parts: list[dict], out_dir: Path, multi: bool, cfg: dict,
                 progress: Callable[[float | None, int | None, int | None], None], chain: list | None = None) -> Path:
    """Several items of one post in one ZIP (stored, not recompressed: media is already compressed).

    parts: [{"item_index": int, "format_id": str, "source": dict | None}, ...]
    Images with a known source are fetched directly; gallery-dl items come from
    one gallery-dl run; other items use the normal per-item download.
    """
    import zipfile

    backend = _backend(platform, backend_name, cfg, chain)
    work = out_dir / "parts"
    work.mkdir(mode=0o700, exist_ok=True)
    files: list[tuple[int, Path]] = []
    n = len(parts)
    limit = int(cfg["max_filesize"])
    try:
        if isinstance(backend, GalleryDlBackend):
            got = backend.download_many(url, [p["item_index"] for p in parts], work, cfg["timeout"])
            files = sorted(got.items())
            progress(90.0, None, None)
        else:
            for k, p in enumerate(parts):
                d = work / f"{k:03d}"
                d.mkdir(mode=0o700)
                sub = (lambda pct, done, total, k=k: progress(-1, None, None) if pct == -1 else
                       progress(None if pct is None else (k + pct / 100) / n * 95, None, None))
                path = backend.download(url, p["item_index"], p["format_id"], d, multi, sub, p.get("source"))
                files.append((p["item_index"], path))
                if sum(f.stat().st_size for _, f in files) > limit:
                    raise BackendError("too_large", "zip larger than limit")
    except BackendError as e:
        raise ExtractionFailed(_code(e), backend.name, e.detail[:800]) from None
    if not files:
        raise ExtractionFailed("no_media", backend.name, "nothing to zip")
    if sum(f.stat().st_size for _, f in files) > limit:
        raise ExtractionFailed("too_large", backend.name, "zip larger than limit")
    progress(-1, None, None)
    zpath = out_dir / "media.zip"
    with zipfile.ZipFile(zpath, "w", compression=zipfile.ZIP_STORED) as z:
        for idx, f in files:
            z.write(f, arcname=f"{platform.id}-{idx + 1:02d}{f.suffix.lower()}")
    import shutil

    shutil.rmtree(work, ignore_errors=True)
    return zpath
