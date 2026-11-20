"""Advertising safety: policy file, validator and GET /v1/ad-eligibility (fail closed everywhere)."""
import copy
import json
import logging
import os
from pathlib import Path

import pytest

from app import geoip as geoip_mod
from app.ads_policy import DEFAULT_POLICY_PATH, country_decision, provider_status, validate_policy

REPO = Path(__file__).resolve().parents[3]
CANONICAL = REPO / "config" / "ads-policy.json"
SHIPPED = json.loads(DEFAULT_POLICY_PATH.read_text(encoding="utf-8"))
IPS = ["203.0.113.9", "8.8.8.8", "1.1.1.1", "10.0.0.1", "2001:4860:4860::8888", "198.51.100.7"]


def verified(**changes) -> dict:
    p = copy.deepcopy(SHIPPED)
    v = p["provider"]["verification"]
    v.update(status="VERIFIED", confirmedDate="2026-11-20", evidenceRef="TEST-ONLY evidence ref", confirmedBlockedCategories=list(p["requiredBlockedCategories"]))
    for k, val in changes.items():
        p[k] = val
    return p


class FakeReader:
    def __init__(self, table=None, error=None):
        self.table, self.error = table or {}, error

    def get(self, ip):
        if self.error:
            raise self.error
        cc = self.table.get(ip)
        return {"country": {"iso_code": cc}} if cc else None


@pytest.fixture
def setup(tmp_path, settings, make_client, monkeypatch):
    """Client with its own policy file and (optionally) a fake GeoIP reader."""

    def _make(policy=SHIPPED, reader=None, db_bytes=None, write_policy=True):
        pol = tmp_path / "policy.json"
        if write_policy:
            pol.write_text(policy if isinstance(policy, str) else json.dumps(policy), encoding="utf-8")
        db = tmp_path / "geo.mmdb"
        if db_bytes is not None:
            db.write_bytes(db_bytes)
        if reader is not None:
            monkeypatch.setattr(geoip_mod.GeoIP, "_open", lambda self: reader)
        return make_client(settings, ads_policy_path=pol, geoip_db_path=db, trust_proxy_headers=True)

    return _make


def ask(client, ip=None):
    r = client.get("/v1/ad-eligibility", headers={"X-Real-IP": ip} if ip else {})
    assert r.status_code == 200
    assert r.headers["cache-control"] == "private, no-store"
    return r.json()


# ── Policy file ──────────────────────────────────────────────────────────────────────────────
def test_policy_copies_are_identical_to_the_source_of_truth():
    assert CANONICAL.is_file(), "config/ads-policy.json missing"
    assert DEFAULT_POLICY_PATH.read_bytes() == CANONICAL.read_bytes(), "run: bash scripts/sync-ads-policy.sh"
    web = REPO / "apps" / "web" / "src" / "lib" / "ads" / "ads-policy.json"
    assert web.read_bytes() == CANONICAL.read_bytes(), "run: bash scripts/sync-ads-policy.sh"


def test_shipped_policy_is_valid_and_suppresses_ads():
    assert validate_policy(SHIPPED) == []
    assert SHIPPED["provider"]["name"] == "Adsterra"
    assert SHIPPED["provider"]["verification"]["status"] == "UNVERIFIED"
    assert provider_status(SHIPPED) == (False, "provider_unverified")
    assert SHIPPED["geolocation"]["attribution"] == "IP geolocation by DB-IP (https://db-ip.com), licensed under CC BY 4.0"
    assert SHIPPED["geolocation"]["failClosed"] is True
    ids = {c["id"] for c in SHIPPED["prohibitedCategories"]}
    for needed in ("real_money_gambling", "sports_betting", "online_casinos", "adult_content", "ponzi_schemes", "investment_scams",
                   "fake_financial_opportunities", "malware", "phishing", "deceptive_downloads", "misleading_system_warnings", "other_unsafe"):
        assert needed in ids
    assert set(SHIPPED["requiredBlockedCategories"]) == ids
    for r in SHIPPED["countryRules"]:  # no invented law: every rule cites a source and says whether it needs legal review
        assert r["source"] and isinstance(r["needsLegalVerification"], bool)


@pytest.mark.parametrize("mutate,reason", [
    (lambda p: p["provider"]["verification"].update(status="VERIFIED"), "evidence_missing"),
    (lambda p: p["provider"]["verification"].update(status="VERIFIED", confirmedDate="2026-11-20"), "evidence_missing"),
    (lambda p: p["provider"]["verification"].update(status="VERIFIED", confirmedDate="2026-11-20", evidenceRef="x", confirmedBlockedCategories=["malware"]), "category_unconfirmed"),
    (lambda p: p["provider"]["verification"].update(status="MAYBE"), "policy_invalid"),
    (lambda p: p["requiredBlockedCategories"].remove("phishing"), "policy_invalid"),
    (lambda p: p.update(countryRules=[{"country": "XX", "rule": "suppress", "reason": "r", "source": "", "needsLegalVerification": True, "reviewed": "2026-11-20"}]), "policy_invalid"),
    (lambda p: p.update(countryRules=[{"country": "us", "rule": "suppress", "reason": "r", "source": "s", "needsLegalVerification": True, "reviewed": "2026-11-20"}]), "policy_invalid"),
    (lambda p: p["geolocation"].update(failClosed=False), "policy_invalid"),
    (lambda p: p.update(permittedCategories=["adult_content"]), "policy_invalid"),
])
def test_validator_and_provider_status_fail_closed(mutate, reason):
    p = copy.deepcopy(SHIPPED)
    mutate(p)
    assert provider_status(p)[0] is False
    assert provider_status(p)[1] == reason


def test_country_decision():
    p = verified(countryRules=[{"country": "ZZ", "rule": "suppress", "reason": "test", "source": "test fixture", "needsLegalVerification": True, "reviewed": "2026-11-20"}])
    assert validate_policy(p) == []
    assert country_decision(p, "US") == (True, "eligible")
    assert country_decision(p, "ZZ") == (False, "country_suppressed")
    assert country_decision(p, None) == (False, "country_unknown")
    assert country_decision(SHIPPED, "US") == (False, "provider_unverified")
    assert provider_status(None) == (False, "policy_missing")


# ── Endpoint ─────────────────────────────────────────────────────────────────────────────────
def test_unverified_policy_means_no_ads_and_no_lookup(setup):
    reader = FakeReader(error=AssertionError("must not look up while the provider is unverified"))
    c = setup(SHIPPED, reader=reader)
    assert ask(c, "8.8.8.8") == {"eligible": False, "reason": "provider_unverified", "country": None, "policyVersion": SHIPPED["version"]}


def test_default_settings_use_the_shipped_policy(client):
    j = client.get("/v1/ad-eligibility").json()
    assert j["eligible"] is False and j["reason"] == "provider_unverified"


def test_verified_policy_known_country_is_eligible(setup):
    c = setup(verified(), reader=FakeReader({"8.8.8.8": "US"}))
    assert ask(c, "8.8.8.8") == {"eligible": True, "reason": "eligible", "country": "US", "policyVersion": SHIPPED["version"]}


def test_country_rule_suppresses(setup):
    rule = {"country": "US", "rule": "suppress", "reason": "test", "source": "test fixture", "needsLegalVerification": True, "reviewed": "2026-11-20"}
    c = setup(verified(countryRules=[rule]), reader=FakeReader({"8.8.8.8": "US", "1.1.1.1": "AU"}))
    assert ask(c, "8.8.8.8")["reason"] == "country_suppressed"
    assert ask(c, "1.1.1.1")["eligible"] is True


@pytest.mark.parametrize("ip", ["10.0.0.1", "127.0.0.1", "192.168.1.5", "::1", "fd00::1", "169.254.1.1", "not-an-ip", "::ffff:10.0.0.1"])
def test_private_or_invalid_address_is_unknown(setup, ip):
    c = setup(verified(), reader=FakeReader({ip: "US"}))
    j = ask(c, ip)
    assert (j["eligible"], j["reason"], j["country"]) == (False, "country_unknown", None)


def test_address_not_in_database_is_unknown(setup):
    c = setup(verified(), reader=FakeReader({}))
    assert ask(c, "203.0.113.9")["reason"] == "country_unknown"


def test_no_proxy_header_and_test_client_peer_is_unknown(setup):
    c = setup(verified(), reader=FakeReader({"8.8.8.8": "US"}))
    assert ask(c)["reason"] == "country_unknown"


def test_missing_database(setup):
    c = setup(verified())
    assert ask(c, "8.8.8.8") == {"eligible": False, "reason": "geo_unavailable", "country": None, "policyVersion": SHIPPED["version"]}


def test_corrupt_database(setup):
    c = setup(verified(), db_bytes=os.urandom(4096))
    assert ask(c, "8.8.8.8")["reason"] == "geo_unavailable"


def test_lookup_error(setup):
    c = setup(verified(), reader=FakeReader(error=RuntimeError("boom at 8.8.8.8")))
    assert ask(c, "8.8.8.8")["reason"] == "lookup_error"


def test_missing_and_invalid_policy(setup):
    assert ask(setup(write_policy=False), "8.8.8.8") == {"eligible": False, "reason": "policy_missing", "country": None, "policyVersion": None}


def test_corrupt_policy_json(setup):
    assert ask(setup("{not json"), "8.8.8.8")["reason"] == "policy_missing"


def test_invalid_policy(setup):
    bad = verified()
    bad["requiredBlockedCategories"] = []
    assert ask(setup(bad, reader=FakeReader({"8.8.8.8": "US"})), "8.8.8.8")["reason"] == "policy_invalid"


def test_get_only(setup):
    c = setup(verified(), reader=FakeReader({"8.8.8.8": "US"}))
    assert c.post("/v1/ad-eligibility", json={}).status_code == 405


def test_no_ip_address_in_any_log_line(setup, caplog):
    caplog.set_level(logging.DEBUG)
    for reader in (FakeReader({"8.8.8.8": "US"}), FakeReader(error=RuntimeError("lookup failed for 8.8.8.8 and 203.0.113.9"))):
        c = setup(verified(), reader=reader)
        for ip in IPS:
            ask(c, ip)
    c = setup(verified())  # missing database: warning logged
    for ip in IPS:
        ask(c, ip)
    text = "\n".join(r.getMessage() + " " + str(r.args) + " " + str(r.exc_text or "") for r in caplog.records)
    assert caplog.records, "expected the access log lines"
    for ip in IPS:
        assert ip not in text, ip


def test_rate_limiter_does_not_keep_raw_addresses(setup):
    c = setup(verified(), reader=FakeReader({"8.8.8.8": "US"}))
    ask(c, "8.8.8.8")
    for route in c.app.routes:
        if getattr(route, "path", "") == "/v1/ad-eligibility":
            cells = [cell.cell_contents for cell in (route.endpoint.__closure__ or [])]
            for cell in cells:
                hits = getattr(cell, "_hits", None)
                if hits is not None:
                    assert hits and all("8.8.8.8" not in k for k in hits)
                    return
    raise AssertionError("eligibility rate limiter not found")


# ── Real DB-IP Lite database (CI downloads it; locally: GEOIP_TEST_DB=/path/dbip-country-lite.mmdb) ──
REAL_DB = os.environ.get("GEOIP_TEST_DB", "")


@pytest.mark.skipif(not REAL_DB, reason="set GEOIP_TEST_DB to a downloaded dbip-country-lite.mmdb")
def test_real_dbip_database(tmp_path, settings, make_client):
    db = Path(REAL_DB)
    assert db.is_file(), f"GEOIP_TEST_DB={REAL_DB} does not exist"  # set but missing: FAIL, never skip
    g = geoip_mod.GeoIP(db)
    assert g.available()
    assert g.country("8.8.8.8") == "US"
    one = g.country("1.1.1.1")
    assert isinstance(one, str) and len(one) == 2
    assert g.country("10.0.0.1") is None
    pol = tmp_path / "policy.json"
    pol.write_text(json.dumps(verified()), encoding="utf-8")
    c = make_client(settings, ads_policy_path=pol, geoip_db_path=db, trust_proxy_headers=True)
    assert ask(c, "8.8.8.8") == {"eligible": True, "reason": "eligible", "country": "US", "policyVersion": SHIPPED["version"]}
    assert ask(c, "10.0.0.1")["eligible"] is False
    shipped = make_client(settings, geoip_db_path=db, trust_proxy_headers=True)
    assert ask(shipped, "8.8.8.8")["reason"] == "provider_unverified"  # the real policy: still no ads
