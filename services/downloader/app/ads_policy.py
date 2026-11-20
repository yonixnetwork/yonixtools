"""Advertising policy: the same rules as the website (apps/web/src/lib/ads/policy-core.mjs).

The policy file is config/ads-policy.json in the repository, copied into this package as
ads_policy.json (scripts/sync-ads-policy.sh; tests fail if the copies differ) so the image carries
it. Fail closed: a missing, unreadable or invalid policy, or a provider that is not VERIFIED with
written evidence for every required category, means no ads anywhere.
"""
from __future__ import annotations

import datetime as _dt
import json
import re
from pathlib import Path

DEFAULT_POLICY_PATH = Path(__file__).with_name("ads_policy.json")
_ID = re.compile(r"^[a-z][a-z0-9_]{1,63}$")
_COUNTRY = re.compile(r"^[A-Z]{2}$")


def _is_date(v: object) -> bool:
    if not isinstance(v, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", v):
        return False
    try:
        _dt.date.fromisoformat(v)
        return True
    except ValueError:
        return False


def _non_empty(v: object) -> bool:
    return isinstance(v, str) and v.strip() != ""


def validate_policy(p: object) -> list[str]:
    """Structural validation. Returns the problems found (empty list = valid)."""
    if not isinstance(p, dict):
        return ["policy is not an object"]
    e: list[str] = []
    if not isinstance(p.get("version"), int) or isinstance(p.get("version"), bool) or p["version"] < 1:
        e.append("version must be a positive integer")
    if not _is_date(p.get("lastReviewed")):
        e.append("lastReviewed must be YYYY-MM-DD")
    pr = p.get("provider")
    if not isinstance(pr, dict):
        e.append("provider missing")
    else:
        if pr.get("name") != "Adsterra":
            e.append("provider.name must be Adsterra")
        v = pr.get("verification")
        if not isinstance(v, dict):
            e.append("provider.verification missing")
        else:
            if v.get("status") not in ("UNVERIFIED", "VERIFIED"):
                e.append("provider.verification.status must be UNVERIFIED or VERIFIED")
            if v.get("confirmedDate") is not None and not _is_date(v.get("confirmedDate")):
                e.append("provider.verification.confirmedDate must be null or YYYY-MM-DD")
            if v.get("evidenceRef") is not None and not _non_empty(v.get("evidenceRef")):
                e.append("provider.verification.evidenceRef must be null or a non-empty string")
            c = v.get("confirmedBlockedCategories")
            if not isinstance(c, list) or not all(isinstance(x, str) and _ID.match(x) for x in c):
                e.append("provider.verification.confirmedBlockedCategories must be a list of category ids")
    ids: list[str] = []
    cats = p.get("prohibitedCategories")
    if not isinstance(cats, list) or not cats:
        e.append("prohibitedCategories must be a non-empty list")
    else:
        for c in cats:
            if not isinstance(c, dict) or not isinstance(c.get("id"), str) or not _ID.match(c["id"]) or not _non_empty(c.get("label")):
                e.append("prohibitedCategories entries need an id and a label")
                continue
            if c["id"] in ids:
                e.append(f"duplicate prohibited category {c['id']}")
            ids.append(c["id"])
    req = p.get("requiredBlockedCategories")
    if not isinstance(req, list):
        e.append("requiredBlockedCategories must be a list")
    else:
        e += [f"requiredBlockedCategories: unknown category {i}" for i in req if i not in ids]
        e += [f"requiredBlockedCategories must include {i}" for i in ids if i not in req]
    perm = p.get("permittedCategories")
    if not isinstance(perm, list) or not all(isinstance(x, str) and _ID.match(x) for x in perm):
        e.append("permittedCategories must be a list of category ids")
    else:
        e += [f"category {i} cannot be both prohibited and permitted" for i in perm if i in ids]
    rules = p.get("countryRules")
    if not isinstance(rules, list):
        e.append("countryRules must be a list")
    else:
        seen: set[str] = set()
        for r in rules:
            if not isinstance(r, dict) or not isinstance(r.get("country"), str) or not _COUNTRY.match(r["country"]):
                e.append("countryRules: country must be an ISO 3166-1 alpha-2 code")
                continue
            cc = r["country"]
            if cc in seen:
                e.append(f"countryRules: duplicate {cc}")
            seen.add(cc)
            if r.get("rule") not in ("suppress", "allow"):
                e.append(f"countryRules {cc}: rule must be suppress or allow")
            if not _non_empty(r.get("reason")):
                e.append(f"countryRules {cc}: reason required")
            if not _non_empty(r.get("source")):
                e.append(f"countryRules {cc}: source citation required")
            if not isinstance(r.get("needsLegalVerification"), bool):
                e.append(f"countryRules {cc}: needsLegalVerification must be true or false")
            if not _is_date(r.get("reviewed")):
                e.append(f"countryRules {cc}: reviewed must be YYYY-MM-DD")
    g = p.get("geolocation")
    if not isinstance(g, dict) or g.get("failClosed") is not True or not all(_non_empty(g.get(k)) for k in ("provider", "license", "attribution")):
        e.append("geolocation needs provider, license, attribution and failClosed: true")
    if not isinstance(p.get("sources"), list) or not p["sources"]:
        e.append("sources must be a non-empty list")
    return e


def provider_status(p: object) -> tuple[bool, str]:
    """(ok, reason) without any visitor data. Reasons as on the website."""
    if p is None:
        return False, "policy_missing"
    if validate_policy(p):
        return False, "policy_invalid"
    assert isinstance(p, dict)
    v = p["provider"]["verification"]
    if v["status"] != "VERIFIED":
        return False, "provider_unverified"
    if not v.get("confirmedDate") or not v.get("evidenceRef"):
        return False, "evidence_missing"
    if any(i not in v["confirmedBlockedCategories"] for i in p["requiredBlockedCategories"]):
        return False, "category_unconfirmed"
    return True, "ok"


def country_decision(p: object, country: str | None) -> tuple[bool, str]:
    ok, reason = provider_status(p)
    if not ok:
        return False, reason
    assert isinstance(p, dict)
    if not isinstance(country, str) or not _COUNTRY.match(country):
        return False, "country_unknown"
    for r in p["countryRules"]:
        if r["country"] == country and r["rule"] == "suppress":
            return False, "country_suppressed"
    return True, "eligible"


def load_policy(path: Path) -> dict | None:
    """The policy as parsed JSON, or None when it is missing or unreadable (= no ads)."""
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return data if isinstance(data, dict) else None
