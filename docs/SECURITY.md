# Security

## Threat model: the downloader

The downloader fetches URLs on behalf of anonymous users, so it is the main attack surface.

| Risk | Defence | Verified by |
|---|---|---|
| SSRF to internal services or cloud metadata | Host **allowlist** of eight platforms; IP-literal, credential, port, scheme and IDN-lookalike URLs rejected (`platforms.py`) | `test_platforms.py` (26 rejection cases, e.g. `169.254.169.254`, `[::1]`, `2130706433`, `instagram.com@evil.com`, Cyrillic lookalikes) |
| Redirect to an internal host | Short links resolved manually; **every hop** must be HTTPS, on the same platform's hosts, and resolve to public IPs (`resolver.py`) | `test_resolver.py` (off-platform, http downgrade, metadata IP, loops, private DNS) |
| DNS rebinding / private DNS answers | Process-wide `getaddrinfo` guard in the API **and every worker**. Connections can only reach globally routable unicast addresses (IPv4-mapped, 6to4 and Teredo unwrapped). Any private record fails the check | `test_netguard.py`, `test_pipeline.py::test_socket_guard_blocks_local_targets_even_in_worker` (real yt-dlp refused to reach 127.0.0.1) |
| yt-dlp as an open proxy | Only exact per-platform extractors are loaded; `generic` never is | `test_extractors.py::test_only_platform_extractors_are_loaded` (all 8 platforms) |
| FFmpeg fetching URLs | HLS/DASH downloaded natively by yt-dlp inside the guarded process; FFmpeg only merges local files | Configuration (`hls_prefer_native`); pipeline HLS test |
| Command injection | No shell anywhere; argument lists only. The browser sends opaque format ids matched against a whitelist regex **and** against the formats extraction offered; selectors are fixed strings | `test_format_id_whitelist`, `test_job_validation` |
| Path traversal | Job ids are 144-bit random tokens validated by regex; file names come from the worker and must match `media.<ext>` inside the job directory | `test_unknown_or_malicious_job_ids`, `test_worker_cannot_make_api_serve_files_outside_job_dir` |
| Resource exhaustion | Per-IP rate limits (Nginx and app), global queue cap, per-client active-job cap, extraction concurrency, job/extract timeouts with process-group kill, worker rlimits (memory, file size, CPU, fds), file size and duration limits, free-disk and temp-usage guards, 8 KB body limit | `test_api.py`, `test_load.py`, `test_pipeline.py::test_size_limit_is_enforced` |
| Zombie workers | Worker watchdog plus `PR_SET_PDEATHSIG`: if the API dies or a deadline passes, the worker kills its own process group | `test_worker_dies_with_its_parent`, `test_worker_deadline_kills_hung_operations` |
| Information leakage | Uniform JSON errors with fixed messages; no stack traces, paths or extractor output; logs record host plus URL hash, not full URLs; `/internal/stats` is loopback-only and blocked at Nginx; no docs/OpenAPI endpoints | `test_worker_crash_and_garbage_are_errors_not_success`, `test_internal_stats_not_reachable_remotely`, smoke test |
| Spoofed client IPs | `X-Real-IP` trusted only with `TRUST_PROXY_HEADERS=1` (behind the bundled Nginx, which overwrites it) | `test_proxy_headers_only_trusted_when_configured`; chain test (spoofed IP never reached the API logs) |
| Private content and DRM | No cookies, logins or DRM handling. Private, login-only, age-gated and DRM content returns an explicit error | Error classification tests |

## Website

- Static files only, so there is no server-side code on the web tier.
- Security headers (`deploy/nginx/security-headers.conf`): a strict CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` (camera allowed for this site only, for the QR scanner), COOP, and HSTS at the edge. Every feature was exercised in Chromium under the production CSP with **zero violations**. `'unsafe-inline'` is needed for scripts because the static export cannot use nonces.
- Browser tools process files locally. `localStorage` holds only the theme and recently used tool slugs.
- Links decoded by the QR scanner are shown, never opened automatically (`rel="noopener noreferrer nofollow"`).

## Containers

Non-root user, read-only root filesystem, `cap_drop: ALL`, `no-new-privileges`, PID/memory/CPU limits, only `127.0.0.1:8090` published, and the downloader reachable only on the internal network.

## Dependency audits (2026-11-06)

- `npm audit` (all dependencies): **0 vulnerabilities**
- `pip-audit -r requirements.txt`: **no known vulnerabilities**
- CI runs both on every push.

## Secrets

The app needs none. `.env` files are git-ignored, and only `.env.example` files are committed. Deployment secrets live in GitHub environment secrets.
