"""Anonymous ad-delivery counts (no IPs, no URLs, no identifiers, nothing per visitor).

The site reports, per ad placement, how a slot ended: the frame was requested, a real
creative rendered ("filled"), the network returned nothing ("empty"), or the ad scripts
were blocked/unreachable ("blocked"). Only these enum values and a placement id are
accepted, and only counts are kept, in memory (reset on restart). This is NOT
impressions, clicks or revenue: those come from the ad networks' own dashboards.
"""
from __future__ import annotations

import re
import threading
import time

OUTCOMES = ("requested", "filled", "empty", "blocked")
UNITS = ("native", "banner300x250", "banner728x90", "banner320x50", "monetagPush")
DEVICES = ("mobile", "desktop")
PLACEMENT_RE = re.compile(r"^(home|tool|downloader|listing)\.[a-z0-9-]{1,32}$")
MAX_KEYS = 400
MAX_EVENTS = 12


class AdStats:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._counts: dict[tuple[str, str, str], dict[str, int]] = {}
        self.since = time.time()

    def record(self, events: object) -> int:
        """Validate and count a batch. Invalid entries are ignored. Returns how many counted."""
        if not isinstance(events, list):
            return 0
        n = 0
        with self._lock:
            for e in events[:MAX_EVENTS]:
                if not isinstance(e, dict):
                    continue
                p, u, o, d = e.get("p"), e.get("u"), e.get("o"), e.get("d")
                if not (isinstance(p, str) and PLACEMENT_RE.match(p) and u in UNITS and o in OUTCOMES and d in DEVICES):
                    continue
                key = (p, u, d)
                row = self._counts.get(key)
                if row is None:
                    if len(self._counts) >= MAX_KEYS:
                        continue
                    row = self._counts[key] = dict.fromkeys(OUTCOMES, 0)
                row[o] += 1
                n += 1
        return n

    def snapshot(self) -> dict:
        with self._lock:
            rows = [{"placement": p, "unit": u, "device": d, **c} for (p, u, d), c in sorted(self._counts.items())]
        return {"since": int(self.since), "rows": rows, "note": "Counts of ad slot outcomes on this server since it started. Not impressions, clicks or revenue."}
