"""Country lookup from the DB-IP Lite country database (MMDB), server-side only.

IP geolocation by DB-IP (https://db-ip.com), licensed under CC BY 4.0.
The database is a file on the host (deploy/geoip, refreshed monthly by deploy/scripts/update-geoip.sh)
mounted read-only into the container. It is re-opened automatically when the file changes, so a
monthly update needs no restart. The address is used for this one lookup and never stored or logged.
"""
from __future__ import annotations

import ipaddress
import threading
import time
from pathlib import Path


class GeoUnavailable(Exception):
    """No usable database (missing, unreadable, corrupt, wrong type)."""


class GeoIP:
    CHECK_EVERY_SECONDS = 60.0

    def __init__(self, path: Path):
        self.path = path
        self._lock = threading.Lock()
        self._reader = None
        self._stamp: tuple[int, int] | None = None
        self._checked = 0.0

    def _open(self):
        now = time.monotonic()
        with self._lock:
            if self._reader is not None and now - self._checked < self.CHECK_EVERY_SECONDS:
                return self._reader
            self._checked = now
            try:
                st = self.path.stat()
            except OSError:
                self._reader = None
                self._stamp = None
                raise GeoUnavailable("database missing") from None
            stamp = (st.st_mtime_ns, st.st_size)
            if self._reader is not None and stamp == self._stamp:
                return self._reader
            try:
                import maxminddb

                reader = maxminddb.open_database(str(self.path))
                meta = reader.metadata()
                if "country" not in str(meta.database_type).lower():
                    raise GeoUnavailable("not a country database")
            except GeoUnavailable:
                self._reader = None
                raise
            except Exception:  # corrupt or unreadable file: fail closed
                self._reader = None
                raise GeoUnavailable("database unreadable") from None
            self._reader, self._stamp = reader, stamp
            return reader

    def available(self) -> bool:
        try:
            self._open()
            return True
        except GeoUnavailable:
            return False

    def country(self, ip: str) -> str | None:
        """ISO 3166-1 alpha-2 code, or None when the address is not public or not in the database.
        Raises GeoUnavailable when there is no usable database."""
        try:
            addr = ipaddress.ip_address(ip)
        except ValueError:
            return None
        if isinstance(addr, ipaddress.IPv6Address) and addr.ipv4_mapped:
            addr = addr.ipv4_mapped
        if not addr.is_global:
            return None
        rec = self._open().get(str(addr))
        if not isinstance(rec, dict):
            return None
        country = rec.get("country")
        code = country.get("iso_code") if isinstance(country, dict) else None
        return code if isinstance(code, str) and len(code) == 2 and code.isalpha() and code.isupper() else None
