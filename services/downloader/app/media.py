"""Normalised media description returned by every extraction backend."""
from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field

# Opaque format ids handed to the browser. They map to backend-specific
# selectors inside the worker; the browser never sends raw selectors.
FORMAT_ID_RE = re.compile(r"^(v:(best|\d{3,4})|a:(best|mp3)|i:(best|\d{2,5})|f:best|g:\d{1,3})(~(jpg|png|webp))?$")
# Image conversions the browser may request on top of an image format id ("i:best~png").
IMAGE_CONVERSIONS = ("jpg", "png", "webp")


def split_format(format_id: str) -> tuple[str, str | None]:
    """'i:best~png' -> ('i:best', 'png'); 'v:720' -> ('v:720', None)."""
    base, _, conv = format_id.partition("~")
    return base, (conv or None)


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
    width: int | None = None
    height: int | None = None


def media_type(items: list[MediaItem]) -> str:
    """video | videos | image | images | audio | mixed: what the post really contains."""
    kinds = {i.kind for i in items}
    if len(kinds) > 1:
        return "mixed"
    k = next(iter(kinds), "video")
    if k == "audio":
        return "audio"
    return k + ("s" if len(items) > 1 else "")


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
        def item(it: MediaItem) -> dict:
            d: dict = {
                "index": it.index,
                "kind": it.kind,
                "thumbnail": it.thumbnail,
                "formats": [{k: v for k, v in asdict(f).items() if v is not None} for f in it.formats],
            }
            if it.duration_seconds:
                d["durationSeconds"] = it.duration_seconds
            if it.width and it.height:
                d["width"], d["height"] = it.width, it.height
            if it.kind == "image":
                d["conversions"] = list(IMAGE_CONVERSIONS)
            return d

        return {
            "platform": self.platform,
            "mediaType": media_type(self.items),
            "title": self.title,
            "author": self.author,
            "thumbnail": self.thumbnail,
            "durationSeconds": self.duration_seconds,
            "items": [item(it) for it in self.items],
        }

    def to_dict(self) -> dict:
        return asdict(self)

    @staticmethod
    def from_dict(d: dict) -> "MediaInfo":
        items = [MediaItem(index=i["index"], kind=i["kind"], thumbnail=i.get("thumbnail"), duration_seconds=i.get("duration_seconds"),
                           width=i.get("width"), height=i.get("height"), formats=[MediaFormat(**f) for f in i["formats"]]) for i in d["items"]]
        return MediaInfo(platform=d["platform"], backend=d["backend"], title=d["title"], items=items, author=d.get("author"),
                         thumbnail=d.get("thumbnail"), duration_seconds=d.get("duration_seconds"), extra=d.get("extra") or {})
