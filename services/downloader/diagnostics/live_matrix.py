"""Live platform diagnostics: which extraction methods actually work, and why the others fail.

Runs real requests against public sample posts (taken from yt-dlp's own test
suite). For every sample and method it records: extraction result, number of
formats, the exact error text, and whether a small real download succeeded.

    python diagnostics/live_matrix.py --platform youtube --phase full --out results.json

Phases:
  deployed – the code path deployed on the droplet (app.worker, current deps)
  full     – app.worker plus alternative methods (needs the upgraded deps)
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SAMPLES: dict[str, list[tuple[str, str]]] = {
    "youtube": [("video", "https://www.youtube.com/watch?v=jNQXAC9IVRw"), ("video", "https://www.youtube.com/watch?v=BaW_jenozKc"), ("short", "https://www.youtube.com/shorts/BaW_jenozKc")],
    "tiktok": [("video", "https://www.tiktok.com/@barudakhb_/video/6984138651336838402"), ("video", "https://www.tiktok.com/@hara_yoimiya/video/7253412088251534594")],
    "instagram": [("reel", "https://www.instagram.com/reel/Chunk8-jurw/"), ("post", "https://www.instagram.com/p/BQ0eAlwhDrw/")],
    "facebook": [("video", "https://www.facebook.com/cnn/videos/10155529876156509/"), ("video", "https://www.facebook.com/radiokicksfm/videos/3676516585958356/")],
    "x": [("video", "https://twitter.com/starwars/status/665052190608723968"), ("gif", "https://twitter.com/oshtru/status/1577855540407197696"), ("video", "https://x.com/captainamerica/status/719944021058060289")],
    "pinterest": [("video", "https://www.pinterest.com/pin/664281013778109217/"), ("image", "https://www.pinterest.ca/pin/441282463481903715/")],
    "reddit": [("video", "https://www.reddit.com/r/videos/comments/6rrwyj/that_small_heart_attack/"), ("video", "https://www.reddit.com/r/aww/comments/90bu6w/heat_index_was_110_degrees_so_we_offered_him_a/")],
    "vimeo": [("video", "https://vimeo.com/76979871"), ("video", "https://vimeo.com/33951933")],
    "snapchat": [("spotlight", "https://www.snapchat.com/spotlight/W7_EDlXWTBiXAEEniNoMPwAAYYWtidGhudGZpAX1TKn0JAX1TKnXJAAAAAA")],
    "dailymotion": [("video", "https://www.dailymotion.com/video/x5kesuj")],
    "twitch": [("clip", "https://clips.twitch.tv/FaintLightGullWholeWheat")],
    "soundcloud": [("audio", "https://soundcloud.com/ethmusic/lostin-powers-she-so-heavy")],
    "bluesky": [("video", "https://bsky.app/profile/bsky.app/post/3l3vgf77uco2g")],
    "streamable": [("video", "https://streamable.com/dnd1")],
}
EXTRACTORS = {
    "youtube": ["youtube"], "tiktok": ["tiktok", "vm.tiktok"], "instagram": ["instagram"], "facebook": ["facebook", "facebook:reel", "facebookpluginsvideo"],
    "x": ["twitter"], "pinterest": ["pinterest"], "reddit": ["reddit"], "vimeo": ["vimeo"], "snapchat": ["snapchatspotlight"],
    "dailymotion": ["dailymotion"], "twitch": ["twitch:clips"], "soundcloud": ["soundcloud"], "bluesky": ["bluesky"], "streamable": ["streamable"],
}
TIMEOUT = 120


def run_ytdlp(url: str, platform: str, extra: dict | None = None, download: bool = True) -> dict:
    """Run yt-dlp in a subprocess (isolates crashes/hangs); returns a result dict."""
    opts = {"extractors": EXTRACTORS[platform], "extra": extra or {}, "url": url, "download": download}
    code = r'''
import json, sys, tempfile, os, re
import yt_dlp
cfg = json.loads(sys.argv[1])
msgs = []
class L:
    def debug(self, m): pass
    def info(self, m): pass
    def warning(self, m): msgs.append("WARNING: " + str(m)[:300])
    def error(self, m): msgs.append(str(m)[:600])
o = {"quiet": True, "no_warnings": False, "logger": L(), "allowed_extractors": [re.escape(e) for e in cfg["extractors"]],
     "noplaylist": True, "cachedir": False, "socket_timeout": 20, "retries": 1, "extractor_retries": 1, "skip_download": True}
o.update(cfg["extra"])
res = {"ok": False}
try:
    with yt_dlp.YoutubeDL(o) as y:
        info = y.extract_info(cfg["url"], download=False)
    entries = info.get("entries") if info.get("_type") in ("playlist", "multi_video") else None
    first = (list(entries)[0] if entries else info) or {}
    fmts = [f for f in (first.get("formats") or []) if f.get("url")]
    real = [f for f in fmts if (f.get("vcodec") not in (None, "none") or f.get("acodec") not in (None, "none")) and f.get("protocol") != "mhtml"]
    heights = sorted({f.get("height") for f in real if f.get("height")}, reverse=True)
    res.update(ok=bool(real or first.get("url")), title=(first.get("title") or "")[:80], formats=len(real), heights=heights[:8],
               extractor=info.get("extractor_key"), notes=sorted({str(f.get("format_note") or "")[:40] for f in real})[:10])
    if res["ok"] and cfg["download"]:
        d = tempfile.mkdtemp()
        o2 = dict(o, skip_download=False, format="worst[filesize<30M]/worst/best", outtmpl=os.path.join(d, "f.%(ext)s"), max_filesize=60*1024*1024)
        try:
            with yt_dlp.YoutubeDL(o2) as y:
                y.download([cfg["url"]])
            files = [os.path.join(d, x) for x in os.listdir(d) if not x.endswith(".part")]
            res["download_bytes"] = max((os.path.getsize(f) for f in files), default=0)
        except Exception as e:
            res["download_error"] = str(e)[:400]
except Exception as e:
    res["error"] = str(e)[:600]
res["messages"] = msgs[-4:]
print("RESULT:" + json.dumps(res))
'''
    return _subprocess([sys.executable, "-c", code, json.dumps(opts)])


def run_worker(url: str, platform: str) -> dict:
    """Run the service's real worker (extract + smallest-format download) exactly as the API would."""
    sys.path.insert(0, str(ROOT))
    req = {"op": "extract", "url": url, "platform": platform,
           "config": {"max_filesize": 200 * 2**20, "max_duration": 4 * 3600, "max_items": 20, "timeout": 90, "memory_mb": 4096}}
    env = {**os.environ, "PYTHONPATH": str(ROOT)}
    t0 = time.time()
    try:
        p = subprocess.run([sys.executable, "-m", "app.worker"], input=json.dumps(req), capture_output=True, text=True, timeout=TIMEOUT, env=env, cwd=ROOT)
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "timeout", "seconds": TIMEOUT}
    lines = [json.loads(x) for x in p.stdout.splitlines() if x.startswith("{")]
    final = next((x for x in reversed(lines) if x.get("type") in ("result", "error")), None)
    if not final:
        return {"ok": False, "error": f"no result (exit {p.returncode}) {p.stderr[-300:]}", "seconds": round(time.time() - t0, 1)}
    if final["type"] == "error":
        return {"ok": False, "error": f'{final["code"]} ({final["backend"]}): {final.get("detail", "")[:400]}', "seconds": round(time.time() - t0, 1)}
    info = final["info"]
    item = info["items"][0]
    fmt = item["formats"][-1]["id"]
    out = tempfile.mkdtemp()
    dreq = {**req, "op": "download", "backend": info["backend"], "item_index": item["index"], "format_id": fmt, "multi": bool(info.get("extra", {}).get("multi")), "out_dir": out}
    try:
        d = subprocess.run([sys.executable, "-m", "app.worker"], input=json.dumps(dreq), capture_output=True, text=True, timeout=TIMEOUT * 2, env=env, cwd=out)
        dl = [json.loads(x) for x in d.stdout.splitlines() if x.startswith("{")]
        dfinal = next((x for x in reversed(dl) if x.get("type") in ("result", "error")), {})
    except subprocess.TimeoutExpired:
        dfinal = {"type": "error", "code": "timeout"}
    res = {"ok": True, "backend": info["backend"], "title": info["title"][:80], "items": len(info["items"]),
           "formats": [f["label"] for f in item["formats"]], "seconds": round(time.time() - t0, 1)}
    if dfinal.get("type") == "result":
        res["download_bytes"] = dfinal.get("size")
    else:
        res["download_error"] = f'{dfinal.get("code")}: {str(dfinal.get("detail", ""))[:300]}'
    shutil.rmtree(out, ignore_errors=True)
    return res


def run_gallerydl(url: str) -> dict:
    try:
        p = subprocess.run([sys.executable, "-m", "gallery_dl", "--config-ignore", "--dump-json", "--range", "1-3", url], capture_output=True, text=True, timeout=TIMEOUT)
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "timeout"}
    try:
        msgs = json.loads(p.stdout or "[]")
    except json.JSONDecodeError:
        msgs = []
    files = [m for m in msgs if isinstance(m, list) and m and m[0] == 3]
    if not files:
        return {"ok": False, "error": (p.stderr or "no files")[-500:]}
    res = {"ok": True, "files": len(files), "exts": sorted({str(f[2].get("extension")) for f in files if len(f) > 2})}
    try:
        req = urllib.request.Request(files[0][1], headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as r:
            res["download_bytes"] = len(r.read(3 * 2**20))
    except Exception as e:
        res["download_error"] = str(e)[:200]
    return res


def run_fxtwitter(url: str) -> dict:
    """Candidate external fallback: FxTwitter's public API (open-source FixTweet, no key)."""
    import re
    m = re.search(r"/status/(\d+)", url)
    if not m:
        return {"ok": False, "error": "no status id"}
    try:
        req = urllib.request.Request(f"https://api.fxtwitter.com/status/{m.group(1)}", headers={"User-Agent": "YoniXTools-diagnostics"})
        with urllib.request.urlopen(req, timeout=20) as r:
            data = json.load(r)
    except Exception as e:
        return {"ok": False, "error": str(e)[:300]}
    media = ((data.get("tweet") or {}).get("media") or {}).get("all") or []
    res = {"ok": bool(media), "media": [{"type": x.get("type"), "w": x.get("width"), "h": x.get("height")} for x in media][:4]}
    if media:
        try:
            with urllib.request.urlopen(urllib.request.Request(media[0]["url"], headers={"User-Agent": "Mozilla/5.0"}), timeout=30) as r:
                res["download_bytes"] = len(r.read(3 * 2**20))
        except Exception as e:
            res["download_error"] = str(e)[:200]
    return res


def methods_for(platform: str, phase: str):
    if phase == "deployed":
        return [("worker (deployed code)", lambda u: run_worker(u, platform))]
    m = [("worker (upgraded deps)", lambda u: run_worker(u, platform)),
         ("yt-dlp", lambda u: run_ytdlp(u, platform)),
         ("yt-dlp, no JS runtime", lambda u: run_ytdlp(u, platform, {"js_runtimes": {}}, download=False))]
    if platform == "youtube":
        for client in ("tv", "web_safari", "mweb", "android_vr", "ios"):
            m.append((f"yt-dlp client={client}", lambda u, c=client: run_ytdlp(u, platform, {"extractor_args": {"youtube": {"player_client": [c]}}})))
    if platform == "x":
        m.append(("yt-dlp api=syndication", lambda u: run_ytdlp(u, platform, {"extractor_args": {"twitter": {"api": ["syndication"]}}})))
        m.append(("FxTwitter API (external)", run_fxtwitter))
    if platform == "facebook":
        m.append(("yt-dlp via plugins embed", lambda u: run_ytdlp("https://www.facebook.com/plugins/video.php?href=" + urllib.parse.quote(u, safe=""), platform)))
    if platform == "vimeo":
        m.append(("yt-dlp via player URL", lambda u: run_ytdlp(u.replace("https://vimeo.com/", "https://player.vimeo.com/video/"), platform)))
    if platform in ("instagram", "x", "pinterest", "reddit", "tiktok", "bluesky", "twitch", "soundcloud"):
        m.append(("gallery-dl", run_gallerydl))
    return m


def main() -> int:
    import urllib.parse  # noqa: F401  (used in lambdas)
    ap = argparse.ArgumentParser()
    ap.add_argument("--platform", required=True)
    ap.add_argument("--phase", choices=["deployed", "full"], default="full")
    ap.add_argument("--out", default="results.json")
    a = ap.parse_args()
    rows = []
    for ctype, url in SAMPLES[a.platform]:
        for name, fn in methods_for(a.platform, a.phase):
            t0 = time.time()
            try:
                r = fn(url)
            except Exception as e:  # never let one method kill the run
                r = {"ok": False, "error": f"harness: {type(e).__name__}: {e}"[:300]}
            r.setdefault("seconds", round(time.time() - t0, 1))
            row = {"platform": a.platform, "phase": a.phase, "content": ctype, "url": url, "method": name, **r}
            rows.append(row)
            status = "OK " if r.get("ok") and (r.get("download_bytes") or 0) > 0 else ("META" if r.get("ok") else "FAIL")
            detail = r.get("error") or r.get("download_error") or f'{r.get("download_bytes", 0)} bytes, formats={r.get("formats")}'
            print(f"[{status}] {a.platform:<10} {ctype:<9} {name:<28} {str(detail)[:220]}", flush=True)
    Path(a.out).write_text(json.dumps(rows, indent=1))
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a") as f:
            f.write(f"\n### {a.platform} ({a.phase})\n\n| content | method | result | detail |\n|---|---|---|---|\n")
            for r in rows:
                res = "✅ download" if r.get("ok") and (r.get("download_bytes") or 0) > 0 else ("⚠️ metadata only" if r.get("ok") else "❌")
                det = (r.get("error") or r.get("download_error") or f'{r.get("download_bytes")} B').replace("|", "/").replace("\n", " ")[:160]
                f.write(f"| {r['content']} | {r['method']} | {res} | {det} |\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
