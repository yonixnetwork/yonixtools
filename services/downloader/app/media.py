"""Normalised media description returned by every extraction backend."""
from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field

# Opaque format ids handed to the browser. They map to backend-specific
# selectors inside the worker; the browser never sends raw selectors.
FORMAT_ID_RE = re.compile(r"^(v:(best|\d{3,4})|a:best|i:best|f:best|g:\d{1,3})$")


@dataclass
class MediaFormat:
    id: str
    label: str
    ext: str
    kind: str  # video | audio | image
    filesize: int | None = None


@dataclass
class MediaItem:
    index: int
    kind: str  # video | image | audio
    formats: list[MediaFormat]
    thumbnail: str | None = None
    duration_seconds: float | None = None


@dataclass
class MediaInfo:
    platform: str
    backend: str
    title: str
    items: list[MediaItem]
    author: str | None = None
    thumbnail: str | None = None
    duration_seconds: float | None = None
    extra: dict = field(default_factory=dict)

    def public(self) -> dict:
        """Shape sent to the browser (camelCase, no backend internals)."""
        return {
            "platform": self.platform,
            "title": self.title,
            "author": self.author,
            "thumbnail": self.thumbnail,
            "durationSeconds": self.duration_seconds,
            "items": [
                {
                    "index": it.index,
                    "kind": it.kind,
                    "thumbnail": it.thumbnail,
                    "formats": [{k: v for k, v in asdict(f).items() if v is not None} for f in it.formats],
                }
                for it in self.items
            ],
        }

    def to_dict(self) -> dict:
        return asdict(self)

    @staticmethod
    def from_dict(d: dict) -> "MediaInfo":
        items = [MediaItem(index=i["index"], kind=i["kind"], thumbnail=i.get("thumbnail"), duration_seconds=i.get("duration_seconds"),
                           formats=[MediaFormat(**f) for f in i["formats"]]) for i in d["items"]]
        return MediaInfo(platform=d["platform"], backend=d["backend"], title=d["title"], items=items, author=d.get("author"),
                         thumbnail=d.get("thumbnail"), duration_seconds=d.get("duration_seconds"), extra=d.get("extra") or {})
