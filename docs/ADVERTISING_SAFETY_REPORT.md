# Advertising Safety Report

| Field | Value |
|---|---|
| Date | 2026-11-20 |
| Scope | Adsterra units (Native, 300×250, 728×90, 320×50) on yonixtools.com, served from ads.yonixtools.com |
| Current state | **All public ads suppressed, everywhere.** Monetag disabled. |
| Policy file | [`config/ads-policy.json`](../config/ads-policy.json) (version 1, last reviewed 2026-11-14) |
| Not legal advice | Country rules and any legal point need professional verification |

## 1. Current state, and why

The owner's rule: *"All Adsterra ads must remain suppressed globally until written confirmation proves the required advertising categories can be blocked."*

We have no such confirmation. The research in [docs/i18n/ADSTERRA_CONTROLS_RESEARCH.md](i18n/ADSTERRA_CONTROLS_RESEARCH.md) (not repeated here) found:
- Adsterra documents only a mainstream vs. "all ads" choice.
- Adsterra says, in general terms, that managers can exclude ad types on request.
- Nothing documented, self-serve or guaranteed covers gambling, betting, financial scams, deceptive downloads or fake system warnings.
- Nothing covers per-country category controls.

So the policy file records the provider as **`UNVERIFIED`**. With that status:

| Where | What happens |
|---|---|
| Every public page | No ad slot is rendered: no `<aside class="ad-slot">`, no iframe, no reserved space. `ADS_ENABLED` is false at build time (`apps/web/src/lib/ads/config.ts`). |
| `https://ads.yonixtools.com/ad-frame.html` | Built **without any publisher code**. No Adsterra key, no `bellnewyork.org`, no `atOptions`, no Monetag. It contains the marker `<!-- ytx-ads-policy: suppressed (provider_unverified) -->` and only tells a parent frame to collapse (`{state:"empty", reason:"policy"}`). |
| `/api/v1/ad-eligibility` | `{"eligible":false,"reason":"provider_unverified","country":null,"policyVersion":1}`. The visitor's IP is not even looked up while the provider is unverified. |
| `/admin/ads/` (password) | A red banner reads "Public ads suppressed by policy: provider_unverified…". Every format reports **SUPPRESSED BY POLICY**. |
| `ads.yonixtools.com/ad-test.html` (password) | Keeps the four snippets for manual testing, under a sticky red "Public ads suppressed by policy: provider_unverified" banner. |
| Monetag | Still off (`MONETAG=off`, forced by `production-deploy.sh`). The policy gate also turns Monetag off even if `MONETAG=on` were set (`MONETAG_ENABLED` depends on `ADS_ENABLED`). No Monetag code, zone, request or fallback was added. |

The Adsterra isolation architecture is unchanged. Ads only ever run in frames from `https://ads.yonixtools.com`, and the main site never serves ad documents (`web.conf` `$ytx_wrong_origin`).

## 2. The policy file

`config/ads-policy.json` is the single, auditable source of truth. Two build contexts can't read the repository root, so copies are kept:
- `apps/web/src/lib/ads/ads-policy.json` (website build)
- `services/downloader/app/ads_policy.json` (downloader image)

`bash scripts/sync-ads-policy.sh` updates both copies. A vitest test, a pytest test and `release-check.sh` fail if any copy differs.

| Field | Meaning | Current value |
|---|---|---|
| `version` | Integer. The backend returns it as `policyVersion`; the site accepts an answer only for its own version | `1` |
| `lastReviewed` | Last policy review date | `2026-11-14` |
| `provider.name` | Ad provider | `Adsterra` |
| `provider.units` | Units the policy covers | native, banner300x250, banner728x90, banner320x50 |
| `provider.verification.status` | `UNVERIFIED` or `VERIFIED` | `UNVERIFIED` |
| `provider.verification.confirmedDate` | Date of the written confirmation | `null` |
| `provider.verification.evidenceRef` | Where the written evidence is kept (ticket id, email date, archive location) | `null` |
| `provider.verification.confirmedBlockedCategories` | Only categories the evidence **explicitly** confirms can be blocked | `[]` |
| `prohibitedCategories` | Global prohibitions, applied everywhere: real-money gambling, sports betting, online casinos, adult content, Ponzi/pyramid schemes, investment scams, fake financial opportunities, malware, phishing, deceptive downloads, misleading system warnings, other prohibited/unsafe ads | 12 categories |
| `requiredBlockedCategories` | Categories the provider must confirm. The validator requires **every** prohibited category to be listed | all 12 |
| `permittedCategories` | Categories confirmed as allowed. Informational; eligibility does not read it | `[]` (nothing assumed) |
| `countryRules` | Per-country rules, kept separate from the global list. Each entry needs `country` (ISO alpha-2), `rule` (`suppress`/`allow`), `reason`, `source` (a citation, required), `needsLegalVerification`, `reviewed` | `[]` |
| `geolocation` | DB-IP Lite, CC BY 4.0, attribution sentence, `failClosed: true` | see §5 |
| `sources` | Where the requirements and data come from | 4 entries |

**Validator.** The same rules are implemented in `apps/web/src/lib/ads/policy-core.mjs` and `services/downloader/app/ads_policy.py`, and both are tested against the same file. A policy is invalid in any of these cases:
- a field has the wrong type
- the status is unknown
- a required category is missing or unknown
- a category is both prohibited and permitted
- a country rule has no source, a bad country code, an unknown rule or no `needsLegalVerification`
- `failClosed` is not `true`

An invalid policy means no ads.

**Ads are eligible only when all of these hold:**
- the status is `VERIFIED`;
- `confirmedDate` and `evidenceRef` are set;
- every `requiredBlockedCategories` id is in `confirmedBlockedCategories`;
- the visitor's country is known;
- no `countryRules` entry suppresses that country.

Country rules: there are none, on purpose. No law has been invented. The policy does not assume gambling advertising is illegal (or legal) anywhere. The research file's per-country notes are flagged as needing professional verification. Any future rule must cite its source and set `needsLegalVerification` truthfully. A country rule can only suppress; it never enables ads that the global policy suppresses.

## 3. What must happen to enable ads

1. **Get written confirmation from Adsterra** (personal manager, by email or ticket) for **each** of the 12 required categories. The confirmation must say that ads in that category will not be served to yonixtools.com / ads.yonixtools.com. "Mainstream only" alone is not enough unless the written answer explicitly covers each category. The suggested request is in [PRODUCTION_RELEASE.md §2](PRODUCTION_RELEASE.md).
2. **Store the evidence** where the owner keeps business records.
3. **Edit `config/ads-policy.json`:**
   - `status: "VERIFIED"`
   - `confirmedDate` and `evidenceRef`
   - `confirmedBlockedCategories`: only the ids the evidence explicitly covers
   - `lastReviewed`
   - `version` + 1
   Then run `bash scripts/sync-ads-policy.sh`. If any category is not confirmed, ads stay off (`category_unconfirmed`).
4. **Install the GeoIP database** on the server (`bash deploy/scripts/update-geoip.sh`) and add the monthly cron line (§5).
5. **Update the expectations.** Once the policy is `VERIFIED`, the smoke test switches automatically: it reads the policy file and then expects the units. In `.github/workflows/deploy.yml` "Verify the public site", replace the two policy-suppressed checks with a units check.
6. **Deploy through the normal approved flow.** Then confirm:
   - `/api/v1/ad-eligibility` answers `eligible:true` from a public IP;
   - the admin banner is gone;
   - the public ad frame contains the units.

Nothing in the code enables ads on an assumption.

## 4. How it is enforced (fail closed)

**Build time (website).**
- `apps/web/src/lib/ads/policy.ts` evaluates the policy. If it is not satisfied, `ADS_ENABLED` is false, `AdSlot`/`AdPlacement` render nothing, and Monetag is off.
- `scripts/build-ad-frame.mjs` writes the suppressed public frame.
- `scripts/build-admin.mjs` adds the banner.

**Page view (once VERIFIED).**
- Before creating any ad frame, `AdSlot` waits for `adsEligible()` (`apps/web/src/lib/ads/eligibility.ts`).
- That function makes one same-origin `GET /api/v1/ad-eligibility` per loaded document (`credentials: "omit"`, `cache: "no-store"`, 3 s timeout) and shares the answer with every slot.
- Only `{eligible: true, policyVersion: <this build's version>}` counts.
- Anything else drops the slot before any frame exists: an error, a timeout, a non-200, a malformed answer or a different policy version.
- Only the boolean is kept, in memory. Nothing goes to sessionStorage or localStorage, and the IP and country are not stored on the client.

**Test-only override.**
- `NEXT_PUBLIC_ADS_POLICY_OVERRIDE=test-verified` lets the e2e isolation tests render stubbed ads. It is used by `build:test`, `build:test:monetag` and `build:integrated`.
- `resolveOverride()` **throws, failing the build**, in any of these cases:
  - `NEXT_PUBLIC_SITE_URL` is set to `https://yonixtools.com` (or www);
  - the ad origin is not a local `http://localhost…` origin;
  - the value is unknown.
- Every production build path is covered:
  - the Docker build always sets `NEXT_PUBLIC_SITE_URL`;
  - `deploy.sh` forces `AD_ORIGIN` to `https://ads.yonixtools.com` or empty;
  - `deploy.sh` runs `unset NEXT_PUBLIC_ADS_POLICY_OVERRIDE ADS_ELIGIBILITY_STUB`;
  - `production-deploy.sh` adds `-u NEXT_PUBLIC_ADS_POLICY_OVERRIDE -u ADS_ELIGIBILITY_STUB` to its `env -u` list;
  - the Dockerfile does not pass the variable at all (a unit test checks this).
- The e2e static test server answers eligibility itself only when `ADS_ELIGIBILITY_STUB=eligible`; it is set in `playwright.config.ts` only.

**Fail-closed matrix** (backend reason → result; every row is covered by a test):

| Situation | `reason` | Ads |
|---|---|---|
| Policy file missing or not JSON | `policy_missing` | none |
| Policy fails validation | `policy_invalid` | none |
| Provider not `VERIFIED` (today) | `provider_unverified` | none (no IP lookup at all) |
| `VERIFIED` without date or evidence | `evidence_missing` | none |
| A required category not confirmed | `category_unconfirmed` | none |
| GeoIP database missing, corrupt or wrong type | `geo_unavailable` | none |
| Lookup throws | `lookup_error` | none |
| Private, loopback, link-local, reserved or invalid IP, or not in the database | `country_unknown` | none |
| Country rule `suppress` | `country_suppressed` | none |
| Rate limited (60/min per hashed client) | `rate_limited` (HTTP 429) | none |
| Eligibility request fails or times out (3 s), non-200, other version | (client side) | none |
| Build-time policy not satisfied | (build) | no slot, no ad code in the public frame |
| All of the above pass | `eligible` | yes |

**What ads can never do** (existing isolation, kept and tested):
- No pop-ups or deceptive tabs. The frame sandbox has no `allow-top-navigation`; `integrated.spec.ts` checks that clicking Download opens no popup or new tab and never navigates.
- No interrupting downloads. The download never waits for the ad (`integrated.spec.ts` "ad script hangs").
- No covering controls. There are no ads inside tools, over inputs or Download buttons (`placements.ts` rules, `ad-spacing.spec.ts`, `ads.spec.ts`).
- No modifying links, accessing files or reading the page. The frame runs on a separate origin, so the same-origin policy blocks it.
- No ad is triggered by Download clicks. The panel ad loads once per page view, and under the policy gate not at all.
- We never try to detect or hide a prohibited ad after it is displayed. The only control is not loading ads unless the provider has confirmed the categories in writing.

## 5. Geolocation (DB-IP Lite): design, privacy, attribution, updates

**Design.**
- `GET /v1/ad-eligibility` lives in `services/downloader`: `app/adeligibility.py`, `app/geoip.py` and `app/ads_policy.py`.
- The site reaches it through nginx at `/api/v1/ad-eligibility`.
- Lookups use the `maxminddb==3.2.0` reader (pinned in `requirements.txt`).
- The client IP comes from the same trusted-proxy logic as rate limiting (`client_key()`: `X-Real-IP` set by nginx when `TRUST_PROXY_HEADERS=1`).
- IPv4-mapped IPv6 is unwrapped. Non-global addresses are treated as unknown.
- The response is `{eligible, reason, country, policyVersion}` with `Cache-Control: private, no-store`.
- The database is re-opened automatically within 60 s of a file change, so a monthly update needs no restart.

**Privacy.**
- **IP processing is server-side only.** The browser never sees or sends a country lookup of its own.
- The IP is used only for the lookup. It is never stored or logged, and never returned.
- While the provider is unverified, the IP is not looked up at all.
- The eligibility rate limiter is keyed by an HMAC of the IP with a random per-process key, so not even the in-memory table holds a raw address (tested).
- The country is used **only** for ad eligibility. **It never chooses the language**; no language code reads it.
- The country is returned to the visitor's own browser but is not kept there.
- Lookup errors log only the exception class name, never its message.
- uvicorn's own access log (peer address plus full query string) is now off (`--no-access-log` in the Dockerfile). The app's existing access line has neither.

**Attribution (CC BY 4.0).** Exact sentence, also in the policy file, the script, `app/geoip.py` and the database's `VERSION` file:

> IP geolocation by DB-IP (https://db-ip.com), licensed under CC BY 4.0

**Action for the page owner:** add this sentence to the privacy page (pages were not edited in this workstream).

**Database and update process.**
- `deploy/scripts/update-geoip.sh` runs **on the host**; the downloader container has an egress firewall and only a read-only mount. The script:
  1. downloads `https://download.db-ip.com/free/dbip-country-lite-YYYY-MM.mmdb.gz` (this month, falling back to last month);
  2. checks `gunzip -t`;
  3. checks the size (2–200 MB);
  4. verifies with `maxminddb`: a country database, IPv4+IPv6, built within 100 days, 8.8.8.8 and 1.1.1.1 resolve, 10.0.0.1 does not. It uses the host Python if it has `maxminddb`, otherwise the `yonixtools-downloader` image with `--network none`;
  5. installs atomically into `deploy/geoip/` (git-ignored), keeping `dbip-country-lite.mmdb.previous`;
  6. writes `VERSION` (month, source URL, sha256, install time, attribution).
- On any failure it exits non-zero and leaves the installed file untouched.
- `docker-compose.yml` mounts `deploy/geoip` read-only at `/var/lib/yonixtools/geoip` (the directory, so the atomic rename is seen) and sets `GEOIP_DB_PATH`.
- **Monthly** (owner adds to root's crontab on the server; DB-IP publishes at the start of each month):
  `17 4 3 * *  cd /opt/yonixtools && bash deploy/scripts/update-geoip.sh >> /var/log/yonixtools-geoip.log 2>&1`
- `release-check.sh` reports the database age, and flags anything older than 45 days.
- `deploy.sh` prints a note if the database is missing.

## 6. Logging review

| Log | Before | Now |
|---|---|---|
| Web container nginx (`deploy/nginx/web.conf`) | Default `combined` format: full visitor IP (real_ip module), full URL with query string, referrer | New `ytx_anon` format: IPv4 last octet zeroed, IPv6 first 32 bits only (`2001:db8::`), anything else `-`; path **without** query string; no referrer. `location = /api/v1/ad-eligibility` has `access_log off`, forwards no query string or cookies, GET only. Verified locally with nginx 1.24 (below). |
| Downloader app access line (`main.py`) | Method, path (ids masked), status, ms; no IP | unchanged (no IP, no query) |
| uvicorn access log | Peer address (the nginx container) and full query string | **off** (`--no-access-log`) |
| Host edge nginx (`edge-host.conf`, `edge-ads-origin.conf`) | Default `combined` (full IP, full URL) | **Recommended change added as comments, owner-applied.** These files are not deployed by `deploy.sh`, and no production server was changed. |
| Docker json-file | Rotated (10 MB × 3 web, 20 MB × 5 downloader) | unchanged |

Rate limiting (`limit_req_zone $binary_remote_addr`) still uses the full address in shared memory only; it is never written to disk.

## 7. Test evidence (run 2026-11-20 in the development container)

| Command | Result |
|---|---|
| `cd services/downloader && .venv/bin/python -m pytest -q` | **307 passed, 13 skipped** (`test_ad_eligibility.py`: 35 passed, 1 skipped = the real-DB test without `GEOIP_TEST_DB`) |
| `GEOIP_TEST_DB=<downloaded dbip-country-lite 2026-11> pytest -q tests/test_ad_eligibility.py -k real` | **1 passed**: 8.8.8.8 → US eligible with a test-verified policy; 1.1.1.1 → a 2-letter code (AU); 10.0.0.1 → not eligible; shipped policy → `provider_unverified` |
| `GEOIP_DIR=<tmp> bash deploy/scripts/update-geoip.sh` | Downloaded 2026-11 (8,515,063 bytes), verified "DBIP-Country-Lite, built 2026-11-01", installed with `.previous` and `VERSION`; `GEOIP_MONTH=1999-01` → 404 → exit 1, file unchanged |
| `cd apps/web && npx vitest run tests/unit/ads-policy.test.ts tests/unit/public-exposure.test.ts tests/unit/monetag-policy.test.ts tests/unit/placements.test.ts` | **35 passed, 2 skipped** (the skips need `out-prodlike/`) |
| `cd apps/web && npx tsc --noEmit` | no errors in the advertising files (remaining errors were in `src/app/*`, then being edited by the i18n workstream) |
| `node scripts/build-ad-frame.mjs` (production settings) | public frame has no ad code; ad-test.html keeps the codes with the banner; the override with `https://ads.yonixtools.com` → exit 1 |
| `scripts/nginx-local.sh` + real backend + `deploy/scripts/smoke-test.sh` (Advertising and Ad eligibility sections) | all PASS, including "public ad frame contains no ad code while the policy is unverified", "Monetag disabled", "eligibility: not eligible (provider_unverified)", "eligibility is GET only (403)", "ad origin serves nothing else: /api/v1/ad-eligibility (404)" |
| nginx anonymised log check | `203.0.113.77` → `203.0.113.0`; `2001:db8:abcd:12::99` → `2001:db8::`; `?url=secret-token` not logged; `/api/v1/ad-eligibility` not logged |
| `bash deploy/tests/production-deploy-guards.sh` | **27 passed, 0 failed** |
| `shellcheck -S warning` on changed scripts | clean |

**Not run here; for the owner or CI.**
- Playwright: `npm run build:test && npm run test:e2e`, including the new `tests/e2e/ads-eligibility.spec.ts` and the updated `csp.spec.ts`.
- The integrated suite (`npm run build:integrated && npm run test:e2e:integrated`).
- `npm run build:prodlike` (production-like full build, then the `out-prodlike` checks in `ads-policy.test.ts`).
- The new CI step that downloads the real DB-IP file.

## 8. Outstanding items (need provider or legal verification)

1. **Adsterra written confirmation** for each of the 12 categories (§3). Until then: no ads.
2. **Per-country rules:** none recorded. The country notes in the research file need professional legal review before any rule is added.
3. **Privacy page:** add the DB-IP attribution sentence and a short note that the country is derived server-side from the IP, only for ad eligibility, and not stored. Also check whether the privacy text still describes ads as running.
4. **Server:**
   - run `update-geoip.sh` and add the monthly cron line;
   - optionally apply the commented anonymised log format in the edge nginx files (owner-approved change).
5. **Edge passes the whole site to the web container.** `/api/v1/ad-eligibility` therefore works without an edge change. The edge's own access log keeps full IPs until item 4 is applied.
6. **Re-verification:** treat a change in Adsterra's terms, a new unit or a new provider as invalidating the confirmation. Set the status back to `UNVERIFIED` and bump `version`.
