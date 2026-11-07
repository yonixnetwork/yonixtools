"""Merge live-matrix result files into one compact table (stdout + job summary)."""
import glob
import json
import os
import sys

rows = []
for f in sorted(glob.glob(os.path.join(sys.argv[1] if len(sys.argv) > 1 else ".", "**", "results-*.json"), recursive=True)):
    rows += json.load(open(f))
rows.sort(key=lambda r: (r["platform"], r["phase"] != "deployed", r["content"], r["method"]))
lines = []
for r in rows:
    if r.get("ok") and (r.get("download_bytes") or 0) > 0:
        res, det = "DOWNLOAD-OK", f'{r["download_bytes"]}B ' + (f'fmts={r.get("formats")}' if not isinstance(r.get("formats"), list) else f'{len(r["formats"])} options')
    elif r.get("ok"):
        res, det = "META-ONLY", r.get("download_error") or ""
    else:
        res, det = "FAIL", r.get("error") or ""
    if r.get("entries"):
        det += f' items={r.get("entries")} kinds={",".join(r.get("entry_kinds") or [])}'
        if r.get("image_sizes"):
            det += f' img_sizes={r["image_sizes"][:2]}'
    po = [m for m in (r.get("messages") or []) if m.startswith("DEBUG")]
    if po:
        det += " | " + po[-1][:120]
    det = " ".join(str(det).split())[:300]
    lines.append(f'{r["platform"]:<11} {r["phase"]:<8} {r["content"]:<9} {r["method"]:<27} {res:<11} {det}')
print("\n".join(lines))
s = os.environ.get("GITHUB_STEP_SUMMARY")
if s:
    open(s, "a").write("```\n" + "\n".join(lines) + "\n```\n")
