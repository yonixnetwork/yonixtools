"""In-memory sliding-window rate limiter (single-process deployment)."""
from __future__ import annotations

import time
from collections import defaultdict, deque


class RateLimiter:
    def __init__(self, limit: int, window_seconds: float, max_keys: int = 50_000):
        self.limit = limit
        self.window = window_seconds
        self.max_keys = max_keys
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def hit(self, key: str, now: float | None = None) -> tuple[bool, int]:
        """Record a request. Returns (allowed, retry_after_seconds)."""
        if self.limit <= 0:
            return True, 0
        now = time.monotonic() if now is None else now
        q = self._hits[key]
        while q and q[0] <= now - self.window:
            q.popleft()
        if len(q) >= self.limit:
            return False, max(1, int(q[0] + self.window - now) + 1)
        q.append(now)
        if len(self._hits) > self.max_keys:
            self.prune(now)
        return True, 0

    def prune(self, now: float | None = None) -> None:
        now = time.monotonic() if now is None else now
        for k in [k for k, q in self._hits.items() if not q or q[-1] <= now - self.window]:
            del self._hits[k]
