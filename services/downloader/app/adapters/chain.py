"""Platform adapter = an ordered chain of extraction backends.

Swapping or adding an extractor for one platform only touches this mapping.
"""
from __future__ import annotations

from pathlib import Path
from typing import Callable

from ..media import MediaInfo
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
            if failure.code not in FALLBACK_CODES:
                raise failure from None
    # Report the first backend's error: it is usually the most specific.
    assert first is not None
    raise first


def download(platform: Platform, url: str, backend_name: str, item_index: int, format_id: str, out_dir: Path, multi: bool,
             cfg: dict, progress: Callable[[float | None, int | None, int | None], None], chain: list | None = None) -> Path:
    chain = chain if chain is not None else backends_for(platform, cfg)
    backend = next((b for b in chain if b.name == backend_name), None)
    if backend is None:
        raise ExtractionFailed("invalid_format", backend_name, "backend not available for platform")
    try:
        if isinstance(backend, GalleryDlBackend):
            return backend.download(url, int(format_id.split(":")[1]), out_dir, cfg["timeout"])
        return backend.download(url, item_index, format_id, out_dir, multi, progress)
    except BackendError as e:
        raise ExtractionFailed(_code(e), backend.name, e.detail[:800]) from None
