"""gallery-dl backend for image posts (carousels, galleries, image pins).

gallery-dl (GPL-2.0) is run as a separate program, never imported, and the
launcher installs the same socket guard before it runs.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

from ..media import MediaFormat, MediaInfo, MediaItem
from .ytdlp_backend import BackendError, _clean, _https

IMAGE_EXTS = {"jpg", "jpeg", "png", "webp", "gif", "avif", "heic"}
VIDEO_EXTS = {"mp4", "webm", "mov", "m4v"}
_LAUNCHER = (
    "import sys, runpy\n"
    "from app.netguard import install_socket_guard\n"
    "install_socket_guard()\n"
    "sys.argv = ['gallery-dl'] + sys.argv[1:]\n"
    "runpy.run_module('gallery_dl', run_name='__main__', alter_sys=True)\n"
)


class GalleryDlBackend:
    name = "gallery-dl"

    def __init__(self, max_filesize: int, max_items: int, timeout: int):
        self.max_filesize = max_filesize
        self.max_items = max_items
        self.timeout = timeout

    def _run(self, args: list[str], timeout: int) -> subprocess.CompletedProcess:
        base = [sys.executable, "-c", _LAUNCHER, "--config-ignore", "--no-mtime", "--http-timeout", "20",
                "--retries", "1", "--filesize-max", f"{self.max_filesize // (1024 * 1024)}M"]
        env = {k: v for k, v in os.environ.items() if k in ("PATH", "LANG", "LC_ALL", "HOME", "TMPDIR")}
        env["PYTHONPATH"] = str(Path(__file__).resolve().parents[2])
        try:
            return subprocess.run(base + args, capture_output=True, timeout=timeout, env=env, check=False)
        except subprocess.TimeoutExpired:
            raise BackendError("timeout", "gallery-dl timeout") from None

    def extract(self, url: str, platform: str) -> MediaInfo:
        proc = self._run(["--range", f"1-{self.max_items}", "--dump-json", "--", url], self.timeout)
        files: list[dict] = []
        meta: dict = {}
        try:
            messages = json.loads(proc.stdout.decode("utf-8", "replace") or "[]")
        except json.JSONDecodeError:
            messages = []
        for m in messages:
            if isinstance(m, list) and m and m[0] == 2 and len(m) > 1 and isinstance(m[1], dict):
                meta = meta or m[1]
            elif isinstance(m, list) and m and m[0] == 3 and len(m) > 2 and isinstance(m[2], dict):
                files.append({"url": m[1], **m[2]})
        if not files:
            raise BackendError("raw", proc.stderr.decode("utf-8", "replace")[-800:] or "gallery-dl found no files")
        items: list[MediaItem] = []
        for i, f in enumerate(files[: self.max_items]):
            ext = str(f.get("extension") or "jpg").lower()
            kind = "video" if ext in VIDEO_EXTS else "image" if ext in IMAGE_EXTS else None
            if not kind:
                continue
            label = f"{'Video' if kind == 'video' else 'Image'} {i + 1}{_dims(f)} · {ext.upper()}"
            thumb = _https(f.get("display_url") or (f.get("url") if kind == "image" else None))
            items.append(MediaItem(i, kind, [MediaFormat(f"g:{i}", label, ext, kind, f.get("filesize") or None)], thumb))
        if not items:
            raise BackendError("no_media", "no image/video files")
        title = meta.get("description") or meta.get("content") or meta.get("title") or files[0].get("description") or "Untitled"
        raw_author = meta.get("author")
        author = meta.get("username") or (raw_author.get("name") if isinstance(raw_author, dict) else raw_author)
        return MediaInfo(platform=platform, backend=self.name, title=_clean(str(title), 200), author=_clean(str(author or ""), 100) or None,
                         thumbnail=items[0].thumbnail, items=items, extra={"multi": len(items) > 1})

    def download(self, url: str, item_index: int, out_dir: Path, timeout: int) -> Path:
        proc = self._run(["--range", str(item_index + 1), "-D", str(out_dir), "-f", "media.{extension}", "--", url], timeout)
        files = [p for p in out_dir.iterdir() if p.is_file() and p.name.startswith("media.") and not p.name.endswith(".part")]
        if proc.returncode != 0 or not files:
            raise BackendError("raw", proc.stderr.decode("utf-8", "replace")[-800:] or "gallery-dl produced no file")
        return files[0]


def _dims(f: dict) -> str:
    w, h = f.get("width"), f.get("height")
    return f" ({w}×{h})" if w and h else ""
