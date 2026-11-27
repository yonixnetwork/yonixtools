"""GET /v1/ad-eligibility: may this page view show ads? (owner requirement, advertising safety)

Order (fail closed at every step; the first failing step answers):
 1. the policy file loads and validates                        -> policy_missing / policy_invalid
 2. the provider is VERIFIED with written evidence for every
    required category                                          -> provider_unverified / evidence_missing / category_unconfirmed
    (until then the visitor's address is not even looked up)
 3. the GeoIP database is usable                               -> geo_unavailable
 4. the lookup works                                           -> lookup_error
 5. the address is public and its country is known             -> country_unknown
 6. no country rule suppresses that country                    -> country_suppressed
 otherwise                                                     -> eligible
The country is used for nothing else (never language). The address is used only for the lookup:
it is not stored, not logged, and not returned.
"""
from __future__ import annotations

import logging
from pathlib import Path

from .ads_policy import country_decision, load_policy, provider_status
from .geoip import GeoIP, GeoUnavailable

log = logging.getLogger("ad-eligibility")


class AdEligibility:
    def __init__(self, policy_path: Path, geoip_path: Path):
        self.policy_path = policy_path
        self.geo = GeoIP(geoip_path)

    def decide(self, ip: str | None) -> dict:
        policy = load_policy(self.policy_path)
        version = policy.get("version") if isinstance(policy, dict) and isinstance(policy.get("version"), int) else None
        ok, reason = provider_status(policy)
        if not ok:
            return self._answer(False, reason, None, version)
        try:
            country = self.geo.country(ip or "")
        except GeoUnavailable:
            log.warning("ad eligibility: GeoIP database unavailable; ads suppressed")
            return self._answer(False, "geo_unavailable", None, version)
        except Exception as e:  # never log the message: it could contain the address
            log.warning("ad eligibility: lookup failed (%s); ads suppressed", type(e).__name__)
            return self._answer(False, "lookup_error", None, version)
        eligible, reason = country_decision(policy, country)
        return self._answer(eligible, reason, country, version)

    @staticmethod
    def _answer(eligible: bool, reason: str, country: str | None, version: int | None) -> dict:
        return {"eligible": eligible, "reason": reason, "country": country, "policyVersion": version}
