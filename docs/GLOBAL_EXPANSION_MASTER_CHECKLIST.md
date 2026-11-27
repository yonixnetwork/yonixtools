# YoniXTools global expansion: master checklist

This is the permanent record of every requirement in the master instruction. Each one is mapped to where it is implemented, the test run against it, the actual result, the remaining issues, whether human review is needed, and whether it can go to production.

- **Branch:** `ccr-8d7c85c6-klc198`, based on `main` a9ead30.
- **Production:** unchanged. Nothing was merged, deployed or restarted on the server.
- **Last updated:** 2026-11-27.

**Statuses:** NOT STARTED · IN PROGRESS · IMPLEMENTED · TEST PASSED · HUMAN REVIEW REQUIRED · BLOCKED · FAILED · VERIFIED COMPLETE.

A requirement is VERIFIED COMPLETE only when an automated test or a recorded measurement shows it working. Code that exists without such evidence is marked IMPLEMENTED.

**Prod?** means eligible for production release:
- **Yes:** safe to release as is.
- **Yes (noindex):** may be released, but those pages stay out of search engines until a person reviews the translation.
- **No:** must not be released yet.

## Summary

| Measure | Count |
|---|---|
| Total requirements (rows in sections 1–12) | 90 |
| VERIFIED COMPLETE | 86 |
| TEST PASSED (verified locally, awaiting CI on the final commit) | 0 |
| IMPLEMENTED (no automated test) | 0 |
| HUMAN REVIEW REQUIRED | 1 (Q-01, translation quality) |
| BLOCKED (external confirmation or data needed) | 2 (A-04 Adsterra confirmation, K-04 keyword volumes) |
| NOT STARTED | 1 (T-03, catalogues for the 80 extra locales) |
| FAILED | 0 |
| Incomplete (everything not VERIFIED COMPLETE) | 4 |
| Rows that also need human review before indexing or sign-off (column "Human review") | 16 |

**Production-release readiness:**
- **Code:** ready for review.
- **Translations:** releasable only as machine-translated pages that search engines don't index, until people review them.
- **Ads:** stay suppressed until Adsterra confirms in writing that the banned categories are blocked.
- **The remaining 80 languages:** registered but not translated.

### Test evidence used below (all run on 2026-11-27 unless noted)

| # | Command | Result |
|---|---|---|
| T1 | `npm run typecheck` | no errors |
| T2 | `npm run i18n:check` (English source in sync and every published locale complete) | 30 passed, 2 skipped (write-only modes) |
| T3 | `npx vitest run` (all web unit tests) | 372 passed, 4 skipped (2 need the production-like build, see T7; 2 are write or review modes) |
| T4 | `npm run build:test`, a full build of all 20 locales | 1,686 static pages; 0 pages with a missing-key marker (`grep ⟦` over every `index.html`) |
| T5 | `npx playwright test --project=desktop --project=mobile --project=iphone-ua` | 321 passed, 13 skipped. The skips are the real-nginx and Monetag-on tests; the nginx ones are covered by T6 |
| T6 | Real nginx (`scripts/nginx-local.sh`) + `csp.spec.ts` + `admin.spec.ts` | 30 passed, with CSP checked on every page of every language |
| T7 | `npm run build:prodlike`, then `npx vitest run tests/unit/ads-policy.test.ts` | 16 passed; production-like sitemap has 81 URLs, the same as production today |
| T8 | `npm run build:integrated` + `npm run test:e2e:integrated` (real downloader backend) | 32 passed |
| T9 | `services/downloader`: `pytest -q` | 307 passed, 13 skipped (live-platform tests) |
| T10 | `GEOIP_TEST_DB=<real DB-IP Lite 2026-11> pytest tests/test_ad_eligibility.py` | 36 passed, including real lookups: 8.8.8.8 → US, 1.1.1.1 → AU, 10.0.0.1 → not eligible |
| T11 | `deploy/scripts/update-geoip.sh` | downloaded and verified DBIP-Country-Lite 2026-11 (1,410,860 nodes); a nonexistent month fails with exit 1 and leaves the installed file untouched |
| T12 | `bash deploy/tests/production-deploy-guards.sh` | 27 passed, 0 failed |
| T13 | `shellcheck -S warning` on every deploy, test and helper script | clean |
| T14 | `tests/e2e/a11y.spec.ts` (axe, WCAG 2.1 A/AA) | 26 passed, including /es/, /de/, /ar/, /ur/, /hi/, /ja/ and /th/ (home and tool page) and the open language selector |
| T15 | Page weight and LCP, measured in Chromium on the local build | /pdf-merger/ 1,278 KB (LCP 120 ms); /es/unir-pdf/ 1,304 KB (120 ms); /ar/pdf-merger/ 1,313 KB (204 ms); / 947 KB; /ja/ 989 KB |
| T16 | Visible-text diff of the new English pages against yonixtools.com (/, /pdf-merger/, /about/, /tools/, a category, a guide, /json-formatter/) | Identical apart from text-node splitting, the "Advertisement" labels (ads are now suppressed) and the backend-dependent downloader notice |
| T17 | GitHub Actions CI on commit 7139f87 (pull request #3) | **success**: run 46008394927 (push) and run 46008475847 (pull_request) |

## 1. Project approach and checklist (§1, §2, §14)

| ID | Requirement | Location | Status | Test / result | Remaining issue | Human review | Prod? |
|---|---|---|---|---|---|---|---|
| G-01 | One integrated feature branch, not separate phases | branch `ccr-8d7c85c6-klc198` | VERIFIED COMPLETE | T4–T8: all workstreams build and are tested together | — | No | Yes |
| G-02 | Permanent master checklist with every requirement and the required fields | this file | VERIFIED COMPLETE | Review of this document | Keep it up to date in future work | No | Yes |
| G-03 | When blocked externally, implement the safe fallback, record it and continue | §10, §8 and §5 below | VERIFIED COMPLETE | Ads fail closed (T7, T10); missing keyword volumes recorded as gaps | — | No | Yes |

## 2. Preserve the existing application (§3)

| ID | Requirement | Location | Status | Test / result | Remaining issue | Human review | Prod? |
|---|---|---|---|---|---|---|---|
| P-01 | Verify the repository state and branch | `main` = a9ead30 (the report said 6e50fe3, then a9ead30) | VERIFIED COMPLETE | `git log` | — | No | Yes |
| P-02 | Keep the Next.js/React architecture, static export and nginx hosting | `next.config.ts` (`output: "export"`), `deploy/nginx/web.conf` | VERIFIED COMPLETE | T4, T6 | — | No | Yes |
| P-03 | Downloader backend, its API and error codes unchanged; downloads work | `services/downloader` (new endpoint added only, see A-05) | VERIFIED COMPLETE | T8, T9 | — | No | Yes |
| P-04 | All 62 registry entries, categories and guides kept | `src/lib/registry`, `src/lib/guides.ts` | VERIFIED COMPLETE | `i18n-routes.test.ts`: every page resolves in every locale; T5 every-tool spec | — | No | Yes |
| P-05 | English stays at its existing root URLs, with no redirects | `src/i18n/routes.ts` (English has no prefix) | VERIFIED COMPLETE | `i18n-routes.test.ts` "English URLs are unchanged"; T16; T7 sitemap still 81 URLs | — | No | Yes |
| P-06 | Existing SEO kept: titles, descriptions, structured data, sitemap, robots | `src/lib/seo.ts`, `app/sitemap.ts`, `app/robots.ts` | VERIFIED COMPLETE | `seo.test.ts` and `seo-sitewide.spec.ts` in T3/T5; T16 | — | No | Yes |
| P-07 | Admin area, authentication and security headers kept | `deploy/nginx/web.conf`, `admin.spec.ts`, `csp.spec.ts` | VERIFIED COMPLETE | T6 | — | No | Yes |
| P-08 | Adsterra isolation and deployment safeguards kept | `lib/ads/*`, `deploy/scripts/*` | VERIFIED COMPLETE | T5 ads specs, T6, T12 | — | No | Yes |
| P-09 | Rollback arrangements untouched; YonixAlpha not touched | no server access in this work | VERIFIED COMPLETE | No production command run; the branch diff has no YonixAlpha paths | — | No | Yes |
| P-10 | No functionality removed to make localization easier | the whole diff | VERIFIED COMPLETE | T5 (321 existing and new e2e pass), T8 | One small change: the global 404 page no longer has a search box (it renders outside the providers) and links to every language's home page instead | No | Yes |

## 3. Multilingual system (§4)

| ID | Requirement | Location | Status | Test / result | Remaining issue | Human review | Prod? |
|---|---|---|---|---|---|---|---|
| I-01 | Centralized catalogues with stable keys | `src/i18n/messages/<locale>/<ns>.json` (21 namespaces), `namespaces.ts` | VERIFIED COMPLETE | T2 | — | No | Yes |
| I-02 | i18n library compatible with the static export, with no production Node server | In-house module on the standard `Intl` APIs (`format.ts`, `translator.tsx`, `client.tsx`, `server.ts`) | VERIFIED COMPLETE | T4 static export; production stays nginx-only | Not a third-party library: a deliberate choice, explained in docs/i18n/DEVELOPER_GUIDE.md | No | Yes |
| I-03 | Locale-aware routing; language identifiable from the URL | `app/[slug]/layout.tsx`, `app/[slug]/[...path]/page.tsx`, `routes.ts` | VERIFIED COMPLETE | `i18n-routes.test.ts`; T5 i18n crawl (lang matches the URL on every page) | — | No | Yes |
| I-04 | Plurals and interpolation | `format.ts` (`Intl.PluralRules`, `{name}` placeholders) | VERIFIED COMPLETE | `i18n-routes.test.ts` formatting cases; T2 plural validation per locale (Arabic 6 forms, Russian 4, Japanese 1) | — | No | Yes |
| I-05 | Date, number, file-size and currency formatting | `formatDate`, `formatNumber`, `formatBytes`, `formatCurrency`; `useFormat()` | VERIFIED COMPLETE | Unit tests (de "1.234,5", hi "12,34,567"); T5 tool tests | Some tool outputs stay machine-readable on purpose (ISO dates, converter input values) | No | Yes |
| I-06 | RTL layouts | `<html dir>` from the locale; logical CSS properties and RTL overrides in `globals.css` | VERIFIED COMPLETE | T5 "Arabic renders right-to-left without horizontal overflow"; T14 ar and ur | — | No | Yes |
| I-07 | Localized API error messages, by stable error code | `lib/downloader/error-message.ts`, `messages/*/errors.json` | VERIFIED COMPLETE | `downloader-errors-i18n.test.ts` (English equals errors.py); `i18n-routes.test.ts` "downloader API errors in <locale>" for all 19 locales | — | Yes (wording) | Yes |
| I-08 | Localized SEO metadata | `lib/seo.ts` `pageMetadata({locale})`; `pages`/`registry` catalogues | VERIFIED COMPLETE | T5 i18n crawl (canonical and robots on every page) | Quality needs human review (see Q-01) | Yes | Yes (noindex) |
| I-09 | Localized accessibility labels | every `aria-label`/`title`/`alt` comes from the catalogue | VERIFIED COMPLETE | T14; T2 literal-key scan | — | No | Yes |
| I-10 | Language never forced by IP | No IP use in the language code; the suggestion uses only browser settings | VERIFIED COMPLETE | T5 "suggests, in Spanish, never redirects"; code review: `LanguageSuggest.tsx` | — | No | Yes |
| I-11 | Browser-language suggestion and persistence | `LanguageSuggest.tsx`, `localStorage["ytx-locale"]` | VERIFIED COMPLETE | T5 suggestion test, selector persistence test; `matchBrowserLanguage` unit test | — | No | Yes |
| I-12 | Translation completeness checks in CI | `tests/unit/i18n-catalogue.test.ts`, `.github/workflows/ci.yml` (`npm run i18n:check`) | VERIFIED COMPLETE | T2 locally; T17 CI green | — | No | Yes |

## 4. Language selector (§4)

| ID | Requirement | Location | Status | Test / result | Remaining issue | Human review | Prod? |
|---|---|---|---|---|---|---|---|
| L-01 | Desktop header and mobile drawer | `components/LanguageSelector.tsx`, `Header.tsx` | VERIFIED COMPLETE | T5 selector tests; mobile project | — | No | Yes |
| L-02 | Native-script names and a search field | `locales.ts` (`native`), selector search | VERIFIED COMPLETE | T5 "searchable…" (finds Deutsch from "deut") | — | No | Yes |
| L-03 | Keyboard navigation and screen readers | combobox/listbox roles, arrow keys, Home/End, Enter, Escape | VERIFIED COMPLETE | T5 keyboard-only switch; T14 open selector | — | No | Yes |
| L-04 | Remembers the selection | `rememberLocale()` | VERIFIED COMPLETE | T5 checks `localStorage` | — | No | Yes |
| L-05 | Opens the same page in the chosen language | `alternates.tsx` (`PageAlternates`) | VERIFIED COMPLETE | T5 /pdf-merger/ → /de/pdf-zusammenfuegen/ and back | — | No | Yes |
| L-06 | Clear fallback when there is no equivalent page | `targetFor()` → `<home>?lang-fallback=1`, notice in `LanguageSuggest` | VERIFIED COMPLETE | `i18n-routes.test.ts` "language selector target"; e2e "language fallback" (notice shown in Spanish, dismissible) | No page triggers it today (every built locale has every page) | No | Yes |
| L-07 | RTL and every device size | `dir` on each native name; CSS | VERIFIED COMPLETE | T5 overflow test at 360 px for every locale; T14 | — | No | Yes |
| L-08 | Unfinished languages never shown as fully translated | badge "Machine translation" and a note; incomplete locales are never built | VERIFIED COMPLETE | T5 badge test; `builtLocales()` refuses incomplete published locales (T2) | — | No | Yes |

## 5. 100 languages and translation coverage (§5, §6, §11)

| ID | Requirement | Location | Status | Test / result | Remaining issue | Human review | Prod? |
|---|---|---|---|---|---|---|---|
| T-01 | 100 locales with correct BCP 47 codes | `src/i18n/locales.ts` | VERIFIED COMPLETE | `i18n-catalogue.test.ts`: 100 unique codes and prefixes, canonical per `Intl.getCanonicalLocales` | — | No | Yes |
| T-02 | 20 priority locales fully translated (every key) | `messages/<19 locales>/` (2,347 keys each) | VERIFIED COMPLETE | T2: every published locale complete and valid; T4: 0 missing markers | Machine translations (AI), not reviewed | Yes | Yes (noindex) |
| T-03 | Complete machine catalogues for the other 80 locales "where feasible" | — | NOT STARTED | — | Not done. Each catalogue is about 17,600 English words, and the 19 done here took several usage-limit cycles. The 80 are registered (code, native name, direction, prefix), never built, and listed as NOT STARTED in the coverage report | n/a | No |
| T-04 | Machine translations clearly marked; never called human-reviewed | `status/<locale>.json` (`method: "machine"`, empty `reviews`), selector badge, notice on every page | VERIFIED COMPLETE | `i18n-report.test.ts` "never calls a machine translation reviewed"; T5 machine-notice | — | No | Yes |
| T-05 | Every user-visible part translated (components, tools, errors, SEO, guides, legal pages, admin where applicable) | 21 namespaces; all tool components and pages moved to keys | VERIFIED COMPLETE | T2 literal-key scan (every `t("…")` key exists); T5 English-leftover check on home and tool pages in 19 locales; T4 0 markers | Admin pages are English on purpose (single administrator). No email templates exist. The site has no cookie notice and sets no consent cookies; consent is the ad network's responsibility once ads return (see A-10) | Yes | Yes (noindex) |
| T-06 | Brands, URLs, code and user content not translated | `GLOSSARY` in `config.ts`; translator rules | VERIFIED COMPLETE | T2 (placeholders, tags and link targets must match) | — | Yes | Yes |
| T-07 | Checker detects missing/duplicate keys and invalid placeholders and plurals, plus missing accessibility, SEO and error text | `catalogue.ts` `validateMessage`, `localeReport` | VERIFIED COMPLETE | Validator unit test; T2 | — | No | Yes |
| T-08 | No new user-facing string without a key | `tests/unit/i18n-hardcoded.test.ts` (JSX text and aria-label/placeholder/title/alt scan, allowlist with reasons), literal-key scan in T2 | VERIFIED COMPLETE | Passes, plus a self-test proving it detects hard-coded text | Heuristic: unusual code shapes could slip through; the e2e English-leftover check is a second net | No | Yes |
| T-09 | A locale can't be marked complete with strings missing; production safeguard | `builtLocales()` throws for a published, incomplete locale | VERIFIED COMPLETE | T2 (fails until complete); seen failing earlier in this work, until each locale finished | — | No | Yes |
| T-10 | Translation status per locale: keys, missing, machine, reviewed, reviewer, review date, pages indexable or blocked | `src/i18n/report.ts`; `docs/i18n/TRANSLATION_COVERAGE.md`; admin page `/admin/translations/` (password-protected) | VERIFIED COMPLETE | `npm run i18n:report`; T6 admin protection | — | No | Yes |
| T-11 | Human review workflow | `npm run i18n:review -- <locale> "<ns>:<glob>" "<Reviewer>"` (source and translation hashes; stale on change) | VERIFIED COMPLETE | `tests/unit/i18n-review.test.ts`: machine page noindex; fully reviewed page becomes indexable with reciprocal hreflang + x-default; changed text makes the review stale and the page noindex again | No real review recorded yet (needs human reviewers) | Yes | Yes |
| Q-01 | Translation quality: natural and accurate | the 19 catalogues | HUMAN REVIEW REQUIRED | Automated checks only | Per-locale notes from the translators are in the pull request and below (§16) | Yes | Yes (noindex) |

## 6. International URLs and SEO (§7)

| ID | Requirement | Location | Status | Test / result | Remaining issue | Human review | Prod? |
|---|---|---|---|---|---|---|---|
| U-01 | Localized prefixes /es/, /pt-br/, … | `locales.ts` prefix; routes | VERIFIED COMPLETE | T4, T5 | — | No | Yes |
| U-02 | Natural localized slugs (Latin script); English slugs for other scripts | `registry` and `guides` `*.slug`, `common` `route.*` | VERIFIED COMPLETE | T2 slug rules (ASCII kebab-case, unique, no collisions); examples /es/unir-pdf/, /pt-br/juntar-pdf/, /fr/fusionner-pdf/, /de/pdf-zusammenfuegen/ | Slugs need human review together with the keywords | Yes | Yes |
| U-03 | Self-referencing canonical | `pageMetadata` | VERIFIED COMPLETE | T5 static crawl over every page | — | No | Yes |
| U-04 | Reciprocal hreflang + x-default, to indexable versions only | `hreflangFor()` | VERIFIED COMPLETE | T5 crawl: reciprocity, no hreflang to noindex pages, x-default required; `i18n-routes.test.ts` | Today no translated page is indexable, so pages carry no hreflang. That is correct, and it changes automatically once reviews are recorded | No | Yes |
| U-05 | Localized sitemaps | `app/sitemap.ts` (indexable pages of every locale, with `xhtml:link` alternates) | VERIFIED COMPLETE | T5 crawl (unique, existing, no noindex URLs); T7 (81 URLs) | — | No | Yes |
| U-06 | html lang and dir correct | `RootDocument` | VERIFIED COMPLETE | T5 crawl and the per-locale test | — | No | Yes |
| U-07 | Localized breadcrumbs, internal links and structured data (`inLanguage`), social cards (og:locale) | `views/*`, `lib/seo.ts`, `localizeHref` | VERIFIED COMPLETE | `i18n-routes.test.ts` localizeHref; T5 crawl | — | No | Yes |
| U-08 | Crawlable server-rendered text (no JavaScript-only replacement); built at build time | static export | VERIFIED COMPLETE | T4 (text is in the HTML); English-leftover check reads the rendered page | — | No | Yes |
| U-09 | Pages whose main content is English are not indexed; no thin or duplicate pages to inflate the sitemap | noindex for unreviewed locales | VERIFIED COMPLETE | T5 sitemap check: 0 machine-translated URLs; T7: 81 URLs, as today | — | No | Yes |

## 7. Keyword research (§8)

| ID | Requirement | Location | Status | Test / result | Remaining issue | Human review | Prod? |
|---|---|---|---|---|---|---|---|
| K-01 | Research per language and market, not literal translation | `docs/i18n/KEYWORD_RESEARCH.md`, `keywords.csv` (4,704 rows), `keyword-candidates.json` | VERIFIED COMPLETE | 566 Google autocomplete requests (gl/hl per market), raw data kept | — | Yes | Yes |
| K-02 | Every keyword has the required fields | `keywords.csv` columns | VERIFIED COMPLETE | Column check | — | No | Yes |
| K-03 | No invented search volumes; unvalidated candidates labelled | every row is "UNVALIDATED RESEARCH CANDIDATE", with volume and competition empty | VERIFIED COMPLETE | Review of the CSV | — | No | Yes |
| K-04 | Keyword Planner, Search Console, Bing Webmaster data | — | BLOCKED | — | No account access in this work. Validate after launch (steps in KEYWORD_RESEARCH.md §Outstanding gaps) | Yes | n/a |
| K-05 | Localized titles, descriptions, headings, FAQs, slugs from the research | the 19 catalogues use `keyword-candidates.json` | VERIFIED COMPLETE | T2 | Urdu, Swahili and some Bengali data was thin. Urdu image-converter and cropper terms turned out to be Persian and were not used | Yes | Yes (noindex) |
| K-06 | No pages for unsupported tools or platforms | Routes come from the registry only; YouTube, Vimeo and Reddit stay hidden and noindex | VERIFIED COMPLETE | `seo.test.ts`, `i18n-routes.test.ts` | — | No | Yes |

## 8. Market research (§9)

| ID | Requirement | Location | Status | Test / result | Remaining issue | Human review | Prod? |
|---|---|---|---|---|---|---|---|
| M-01 | `docs/INTERNATIONAL_MARKET_RESEARCH.md`, with the 18 named markets and others | the document | VERIFIED COMPLETE | Content review | Some figures come from search excerpts (marked); legal rows need verification | Yes | Yes |
| M-02 | Dated, reliable sources; no unfounded demand claims; internet population kept separate from tool demand | the document | VERIFIED COMPLETE | Content review | — | Yes | Yes |

## 9. Advertising safety (§10)

| ID | Requirement | Location | Status | Test / result | Remaining issue | Human review | Prod? |
|---|---|---|---|---|---|---|---|
| A-01 | All Adsterra ads (Native, 300×250, 728×90, 320×50) suppressed everywhere until written category confirmation | `config/ads-policy.json` (UNVERIFIED), `lib/ads/policy.ts`, `AdSlot.tsx`, `build-ad-frame.mjs` | VERIFIED COMPLETE | T7: no ad slot on any page, no Adsterra or Monetag key in any public file; T5 | — | No | Yes |
| A-02 | Policy file with provider, status, date, evidence, blocked, permitted, country rules, review date, sources | `config/ads-policy.json` (+ synced copies) | VERIFIED COMPLETE | `ads-policy.test.ts` validator; copies must match | — | No | Yes |
| A-03 | Prohibited categories listed and required for confirmation | `prohibitedCategories` / `requiredBlockedCategories` (12) | VERIFIED COMPLETE | Validator test | — | No | Yes |
| A-04 | Written Adsterra confirmation of category blocking | — | BLOCKED | — | Adsterra's own documentation shows no guaranteed gambling or adult blocking switch (docs/i18n/ADSTERRA_CONTROLS_RESEARCH.md). Ask the account manager in writing, then record the reply in the policy file | Yes (owner) | No |
| A-05 | DB-IP Lite country lookup, server-side; fails closed (unknown country, failed lookup, missing policy) | `services/downloader/app/{geoip,adeligibility,ads_policy}.py`, `GET /v1/ad-eligibility` | VERIFIED COMPLETE | T9, T10 (real database), T5 ads-eligibility spec | — | No | Yes |
| A-06 | Download and maintain the database; CC BY 4.0 attribution; documented update process | `deploy/scripts/update-geoip.sh`, compose mount, privacy page attribution, ADVERTISING_SAFETY_REPORT.md | VERIFIED COMPLETE | T11 | Owner must run it on the server and add the monthly cron line (in the report) | No | Yes |
| A-07 | No raw IP retained; nginx logging reviewed | anonymised `ytx_anon` log format; eligibility endpoint not logged; uvicorn access log off | VERIFIED COMPLETE | Local nginx log check (203.0.113.77 → 203.0.113.0); T10 caplog test | Edge (host nginx) format is commented in the repo for the owner to apply | No | Yes |
| A-08 | Country rules kept separately; no assumed legality | `countryRules: []` with schema (source and legal-verification flag required) | VERIFIED COMPLETE | Validator test | Rules need legal verification before any are added | Yes (legal) | Yes |
| A-09 | Ads never pop up, interrupt downloads, cover controls, change links, open tabs, read files or fire on Download | isolation unchanged | VERIFIED COMPLETE | T5 ads specs; T8 "no popup or new tab" download test | — | No | Yes |
| A-10 | Monetag stays disabled; nothing Monetag added | `MONETAG` default off | VERIFIED COMPLETE | `monetag-policy.test.ts`, T7 (no Monetag markers) | — | No | Yes |
| A-11 | Alternative provider recommendation, if Adsterra can't block | ADSTERRA_CONTROLS_RESEARCH.md §alternatives (AdSense blocking controls, Ezoic) | VERIFIED COMPLETE | Content review | AdSense policy risk for downloader pages noted | Yes | n/a |

## 10. Testing and quality (§12)

| ID | Requirement | Location | Status | Test / result | Remaining issue | Human review | Prod? |
|---|---|---|---|---|---|---|---|
| Q-02 | English pages and all tools still work | existing e2e suites | VERIFIED COMPLETE | T5, T8, T16 | — | No | Yes |
| Q-03 | Localized routes, switching, mobile selector, RTL, overflow, complex scripts | `tests/e2e/i18n.spec.ts` | VERIFIED COMPLETE | T5 (27 i18n tests, including 360 px overflow for every locale) | — | No | Yes |
| Q-04 | Translation completeness, API error translations | `i18n-catalogue.test.ts`, `i18n-routes.test.ts` | VERIFIED COMPLETE | T2, T3 | — | No | Yes |
| Q-05 | Canonical, hreflang, sitemap, robots | `i18n.spec.ts` crawl, `seo.test.ts` | VERIFIED COMPLETE | T5, T3 | — | No | Yes |
| Q-06 | Ad suppression, failed geolocation, unknown country, prohibited categories, isolation, Monetag off | `ads-policy.test.ts`, `ads-eligibility.spec.ts`, `test_ad_eligibility.py` | VERIFIED COMPLETE | T5, T7, T9, T10 | — | No | Yes |
| Q-07 | Accessibility | `a11y.spec.ts` | VERIFIED COMPLETE | T14 | — | No | Yes |
| Q-08 | No test reported as passing without running; skips explained | this file | VERIFIED COMPLETE | Skips listed in T3, T5 and T9 with reasons | — | No | Yes |

## 11. Performance, privacy, security (§13)

| ID | Requirement | Location | Status | Test / result | Remaining issue | Human review | Prod? |
|---|---|---|---|---|---|---|---|
| S-01 | Localized pages built at build time; only the page's own locale and namespaces shipped | `clientMessages()`, `ViewFrame` | VERIFIED COMPLETE | T15: localized pages within about 3% of English; no other locale's strings in the page | — | No | Yes |
| S-02 | Mobile performance acceptable | — | VERIFIED COMPLETE | T15 LCP 120–316 ms locally | English pages are about 20 KB larger uncompressed (/pdf-merger/ HTML 49 → 69 KB; about 18 KB gzipped), from the language list and shell strings. The build has 1,686 pages (about 240 MB of files including Next's per-page navigation data), so the web image grows accordingly | No | Yes |
| S-03 | CDN and caching can't mix languages | language is in the URL path; no cookie or Accept-Language variation | VERIFIED COMPLETE | Design; T5 (explicit locale URLs always render that language) | — | No | Yes |
| S-04 | No sensitive data in analytics or logs; no files or private URLs logged | the site has no analytics; A-07 | VERIFIED COMPLETE | A-07 tests | — | No | Yes |
| S-05 | Existing security controls effective (CSP, admin, ad isolation) | — | VERIFIED COMPLETE | T6 (CSP on all 1,686 pages), T12 | — | No | Yes |
| S-06 | No new production server or paid translation API | static export; translations stored in the repository | VERIFIED COMPLETE | — | — | No | Yes |

## 12. Deployment boundary (§16)

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| D-01 | Not merged into main | VERIFIED COMPLETE | Pull request open for review only |
| D-02 | No deployment, no production workflow run, no container restart or recreation | VERIFIED COMPLETE | No server access; the Deploy workflow was not dispatched |
| D-03 | No DNS, firewall, SSH, environment secret, database, volume, rollback image or backup changes | VERIFIED COMPLETE | Not touched. The edge nginx log format is a commented suggestion only |
| D-04 | YonixAlpha untouched; Monetag not enabled | VERIFIED COMPLETE | Diff; A-10 |

## 13. Final acceptance criteria (§15)

| # | Criterion | Status | Where |
|---|---|---|---|
| 1 | English URLs and functionality intact | VERIFIED COMPLETE | P-05, Q-02 |
| 2 | i18n architecture works | VERIFIED COMPLETE | I-01…I-12 |
| 3 | Selector on desktop and mobile | VERIFIED COMPLETE | L-01…L-08 |
| 4 | Supports up to 100 locales | VERIFIED COMPLETE | T-01 |
| 5 | 20 priority locales complete | VERIFIED COMPLETE (machine translation) | T-02, Q-01 HUMAN REVIEW REQUIRED |
| 6 | Other catalogues have a clear review status | VERIFIED COMPLETE (as NOT STARTED) | T-03, T-10 |
| 7 | Every user-facing component covered by keys | VERIFIED COMPLETE | T-05, T-08 |
| 8 | Missing-translation checks in CI | VERIFIED COMPLETE | I-12 |
| 9 | API errors in the selected language | VERIFIED COMPLETE | I-07 |
| 10 | RTL works | VERIFIED COMPLETE | I-06 |
| 11 | Correct canonical URLs | VERIFIED COMPLETE | U-03 |
| 12 | Reciprocal hreflang | VERIFIED COMPLETE | U-04 |
| 13 | Valid localized sitemaps | VERIFIED COMPLETE | U-05 |
| 14 | SEO metadata localized | VERIFIED COMPLETE | I-08 |
| 15 | Keyword research with evidence | VERIFIED COMPLETE (volumes BLOCKED) | K-01…K-06 |
| 16 | Market research documented | VERIFIED COMPLETE | M-01, M-02 |
| 17 | No invented search volumes | VERIFIED COMPLETE | K-03 |
| 18 | Adsterra suppressed pending confirmation | VERIFIED COMPLETE | A-01 (A-04 BLOCKED) |
| 19 | DB-IP Lite works and is attributed | VERIFIED COMPLETE | A-05, A-06 |
| 20 | Unknown location fails closed | VERIFIED COMPLETE | A-05 |
| 21 | Prohibited categories blocked according to verified policy | VERIFIED COMPLETE (by suppressing everything; provider verification BLOCKED) | A-01, A-04 |
| 22 | Monetag disabled | VERIFIED COMPLETE | A-10 |
| 23 | Ad isolation intact | VERIFIED COMPLETE | P-08 |
| 24 | No ads interrupt downloads | VERIFIED COMPLETE | A-09 |
| 25 | Regression testing passes | VERIFIED COMPLETE | T5, T8, T9 |
| 26 | Performance, privacy, security checks | VERIFIED COMPLETE | S-01…S-06 |
| 27 | CI passes | VERIFIED COMPLETE | T17 |
| 28 | Checklist updated | VERIFIED COMPLETE | this file |
| 29 | Outstanding issues reported | VERIFIED COMPLETE | §14 |
| 30 | No production deployment | VERIFIED COMPLETE | D-02 |

## 14. Outstanding issues (explicit)

1. **The 80 additional locales have no translations (T-03).** They are registered only. The instruction asked for machine catalogues "where feasible", and producing them was not feasible in this work.
2. **None of the 19 translations has been reviewed by a person (Q-01, T-11).** All their pages are `noindex` and stay out of the sitemap. To make pages indexable, a reviewer records approval with `npm run i18n:review`.
3. **Adsterra has not given written category confirmation (A-04).** Ads stay off everywhere until it does.
4. **Keyword volumes and competition are unknown (K-04).** They need Keyword Planner, Search Console and Bing data.
5. **Owner actions on the server, at deploy time:**
   - run `deploy/scripts/update-geoip.sh` and add its monthly cron line;
   - optionally apply the anonymised edge log format.
6. **Language fallback notice (L-06).** It is tested, but cannot occur today because every built language has every page.
7. **Page size (S-02).** English page HTML grew by about 20 KB, and the build is about 20× larger (1,686 pages).
8. **404 page.** The search box was replaced by language links.
9. **Next.js security notice.** During the build, Next.js printed a security advisory recommending an upgrade, and offered to run its upgrade tool. No upgrade was done in this work; that is a separate decision.

## 15. Pre-deployment checklist (owner)

1. Review the pull request, and CI on its final commit.
2. Decide whether to release the 19 machine-translated languages now (as `noindex`) or after review. To hold any back, remove it from `PUBLISHED_LOCALES` in `apps/web/src/i18n/config.ts`.
3. Run `bash deploy/scripts/update-geoip.sh` on the server. It needs the host `download.db-ip.com`.
4. Merge, then deploy with the usual dry run and `--deploy` commands, after approval.
5. **After deploying, check these public URLs:**
   - `/es/`, `/ar/`: language, right-to-left text and the machine-translation notice;
   - `/sitemap.xml`: still 81 URLs;
   - `/api/v1/ad-eligibility`: answers `provider_unverified`.
6. Ask Adsterra for written category blocking. When it arrives, record it in `config/ads-policy.json` and run `scripts/sync-ads-policy.sh`.
7. Arrange human reviewers per language. The translators' notes are in the pull request.

## 16. Translator notes for reviewers (summary)

| Locale | What the reviewer should check |
|---|---|
| es | "IMC" is used instead of BMI (the Spanish standard term); Spain's Spanish ("vídeo", "ordenador"); 7 descriptions are 161–163 characters |
| pt-BR | Twitch gender agreement; "Tabela Price" added to a loan FAQ; BR/BRL examples |
| fr | No notes reported |
| de | "Tools" rather than "Werkzeuge"; "JPG in PDF umwandeln" for image-to-PDF |
| hi | Mix of "फोटो" and "इमेज"; mixed-script SEO titles |
| id | Mix of "download" and "unduh"; JPG ke PDF |
| ar | Arabic unit symbols; "first/second field" in text compare; feddan ambiguity |
| zh-CN | 快拍 / Pin 图; QR level 较高 |
| ja | インスタ in an SEO title; QR level labels |
| ru | Cyrillic brand spellings in SEO titles only |
| bn | পিডিএফ only in SEO fields; BD example |
| ur | Several keyword candidates were Persian, not used; Roman-Urdu search terms added to SEO fields |
| tr | BMI kept (VKİ is the common term); "… video indir" slugs |
| vi | Platform terms with English in brackets |
| ko | 만 나이; QR 쿼타일 |
| it | 58 identical-to-English words (Privacy, Downloader…) |
| nl | Formal "u"; the online-event field accepts only the literal "yes" |
| th | Informal "โหลด" for downloaders |
| sw | Coined technical terms (simba/simbua); English loanwords used where people search in English |

## 17. CI result

GitHub Actions CI on commit 7139f87: **success** for both runs.
- [Run 46008394927](https://github.com/yonixnetwork/yonixtools/actions/runs/46008394927) (push).
- [Run 46008475847](https://github.com/yonixnetwork/yonixtools/actions/runs/46008475847) (pull request #3).

Each run covers the backend pytest, the real DB-IP lookup, the website typecheck, i18n check, unit tests, production-like, integrated and test builds, e2e and real nginx, Docker images, and shellcheck with the deploy guards.
