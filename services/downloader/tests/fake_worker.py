"""Stand-in for app.worker used by API integration tests.

It speaks the real worker protocol but simulates the platform: no network.
Download writes a real file (an FFmpeg-generated MP4 if YTX_FAKE_MEDIA is set).
Behaviour is selected by markers in the URL.
"""
import json
import os
import shutil
import sys
import time

req = json.loads(sys.stdin.read())
url = req["url"]
emit = lambda o: (sys.stdout.write(json.dumps(o) + "\n"), sys.stdout.flush())

if req["op"] == "extract":
    if "private" in url:
        emit({"type": "error", "code": "private", "backend": "yt-dlp", "detail": "This video is private"}); sys.exit(1)
    if "blocked" in url:
        emit({"type": "error", "code": "platform_blocked", "backend": "yt-dlp", "detail": "HTTP Error 429"}); sys.exit(1)
    if "slowextract" in url:
        time.sleep(30)
    if "crash" in url:
        sys.exit(3)
    if "garbage" in url:
        print("not json at all"); sys.exit(0)
    items = [{"index": 0, "kind": "video", "thumbnail": "https://i.example/t.jpg", "duration_seconds": 12,
              "formats": [{"id": "v:best", "label": "Best quality (1080p) · MP4", "ext": "mp4", "kind": "video", "filesize": 2_000_000},
                          {"id": "v:720", "label": "720p · MP4", "ext": "mp4", "kind": "video", "filesize": 1_000_000},
                          {"id": "a:best", "label": "Audio only · M4A", "ext": "m4a", "kind": "audio", "filesize": 200_000}]}]
    if "carousel" in url:
        items = [{"index": i, "kind": "image", "thumbnail": None, "duration_seconds": None,
                  "formats": [{"id": f"g:{i}", "label": f"Image {i + 1} · JPG", "ext": "jpg", "kind": "image", "filesize": None}]} for i in range(3)]
    extra = {"multi": "carousel" in url}
    if "mixedpost" in url:  # yt-dlp style carousel: 1 video + 2 images with real size candidates and sources
        items = [items[0] | {"formats": items[0]["formats"] + [{"id": "a:mp3", "label": "Audio only · MP3 (converted)", "ext": "mp3", "kind": "audio", "filesize": None}]}]
        extra = {"multi": True, "sources": {}}
        for i in (1, 2):
            items.append({"index": i, "kind": "image", "thumbnail": f"https://cdn.example/{i}-480.jpg", "duration_seconds": None, "width": 1080, "height": 1350,
                          "formats": [{"id": "i:best", "label": "Original · 1080×1350 · JPG", "ext": "jpg", "kind": "image", "filesize": None},
                                      {"id": "i:640", "label": "640×800 · JPG", "ext": "jpg", "kind": "image", "filesize": None}]})
            extra["sources"][f"{i}:i:best"] = {"url": f"https://cdn.example/{i}-1080.jpg", "headers": {}}
            extra["sources"][f"{i}:i:640"] = {"url": f"https://cdn.example/{i}-640.jpg", "headers": {}}
    if "hugefile" in url:
        items[0]["formats"][0]["filesize"] = 10**12
    info = {"platform": req["platform"], "backend": "gallery-dl" if "carousel" in url else "yt-dlp", "title": "Test clip", "author": "Tester",
            "thumbnail": "https://i.example/t.jpg", "duration_seconds": 12, "items": items, "extra": extra}
    emit({"type": "result", "info": info}); sys.exit(0)

if req["op"] == "download_zip":
    import zipfile
    out = req["out_dir"]
    emit({"type": "progress", "phase": "processing"})
    with zipfile.ZipFile(os.path.join(out, "media.zip"), "w") as z:
        for p in req["parts"]:
            z.writestr(f"item-{p['item_index']}.bin", json.dumps(p))
    emit({"type": "result", "file": "media.zip", "size": os.path.getsize(os.path.join(out, "media.zip"))}); sys.exit(0)

if req["op"] == "download":
    out = req["out_dir"]
    if "failjob" in url:
        emit({"type": "error", "code": "unavailable", "backend": "yt-dlp", "detail": "Video unavailable"}); sys.exit(1)
    if "slowjob" in url:
        open(os.path.join(out, "media.mp4.part"), "wb").write(b"x" * 1000)
        time.sleep(60)
    for p in (10, 40, 80):
        emit({"type": "progress", "percent": p, "downloaded": p * 1000, "total": 100_000}); time.sleep(0.05)
    if "escape" in url:
        emit({"type": "result", "file": "../../etc/passwd", "size": 1}); sys.exit(0)
    fid = req["format_id"]
    ext = (fid.split("~")[1] if "~" in fid else "jpg") if fid.startswith(("g:", "i:")) else "m4a" if fid == "a:best" else "mp3" if fid == "a:mp3" else "mp4"
    name = f"media.{ext}"
    if req.get("source"):  # images: prove the service handed over the source found during extraction
        open(os.path.join(out, name), "w").write(json.dumps(req["source"]) + " " * 2000)
        emit({"type": "result", "file": name, "size": os.path.getsize(os.path.join(out, name))}); sys.exit(0)
    src = os.environ.get("YTX_FAKE_MEDIA")
    if src and ext == "mp4":
        shutil.copy(src, os.path.join(out, name))
    else:
        with open(os.path.join(out, name), "wb") as f:
            f.write(os.urandom(150_000))
    emit({"type": "result", "file": name, "size": os.path.getsize(os.path.join(out, name))}); sys.exit(0)
