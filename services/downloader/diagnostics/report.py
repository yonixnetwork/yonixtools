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
    det = " ".join(str(det).split())[:230]
    lines.append(f'{r["platform"]:<11} {r["phase"]:<8} {r["content"]:<9} {r["method"]:<27} {res:<11} {det}')
print("\n".join(lines))
s = os.environ.get("GITHUB_STEP_SUMMARY")
if s:
    open(s, "a").write("```\n" + "\n".join(lines) + "\n```\n")
