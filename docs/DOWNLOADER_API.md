# Downloader API (v1)

Base path: `/api` in production (Nginx strips the prefix). All bodies are JSON, and POST requests require `content-type: application/json` (max 8 KB).

## Errors

Every error has the same shape:

```json
{ "error": { "code": "private", "message": "This content is private, so it can't be downloaded.", "platform": "instagram" } }
```

`platform` names the adapter involved, when known.

| Codes | HTTP |
|---|---|
| `invalid_request` | 400 |
| `unsupported_url`, `unsupported_content`, `unsafe_url`, `unavailable`, `private`, `login_required`, `age_restricted`, `geo_blocked`, `drm_protected`, `live_stream`, `too_large`, `too_long`, `no_media`, `invalid_format` | 422 |
| `not_found` | 404 |
| `expired` | 410 |
| `payload_too_large` | 413 |
| `rate_limited` (with `Retry-After`) | 429 |
| `platform_blocked`, `network_error`, `extractor_failed` | 502 |
| `busy` (with `Retry-After`) | 503 |
| `timeout` | 504 |
| `server_error` | 500 |

## `POST /v1/extract`

Request: `{"url": "https://www.instagram.com/reel/…"}`. Short links are resolved first.

Response `200`:

```json
{
  "platform": "youtube", "title": "…", "author": "…", "thumbnail": "https://…", "durationSeconds": 31,
  "items": [{ "index": 0, "kind": "video", "thumbnail": "https://…",
              "formats": [{ "id": "v:best", "label": "Best quality (1080p) · MP4", "ext": "mp4", "kind": "video", "filesize": 9500000 },
                          { "id": "v:720", "label": "720p · MP4", "ext": "mp4", "kind": "video" },
                          { "id": "a:best", "label": "Audio only · M4A", "ext": "m4a", "kind": "audio" }] }]
}
```

Format ids are opaque. They match `^(v:(best|\d{3,4})|a:best|i:best|f:best|g:\d{1,3})$`, and a job may only use ids that extraction returned. Results are cached for 10 minutes.

## `POST /v1/jobs` → `202`

Request: `{"url": "…", "itemIndex": 0, "formatId": "v:720"}`

Response: `{"id": "<token>", "status": "queued", "platform": "youtube"}`

## `GET /v1/jobs/{id}`

```json
{ "id": "…", "status": "queued|running|done|failed|expired", "phase": "queued|downloading|processing|ready", "platform": "youtube", "progress": 42.5,
  "downloadUrl": "/v1/jobs/{id}/file", "filesize": 1234567, "expiresAt": 1762450000,
  "error": { "code": "…", "message": "…" } }
```

`downloadUrl` is present only when `status` is `done`. It is relative to the API base. Creating a job identical to one that is still queued, running or done (same client, link, item and format) returns that existing job instead of starting a new download.

## `GET /v1/jobs/{id}/file`

Streams the file as `Content-Disposition: attachment; filename="yonixtools-<platform>-<id8>.<ext>"`, with `Cache-Control: no-store`. Returns `410 expired` after `FILE_TTL_SECONDS`.

- `HEAD` is supported, so the page can check that the file exists before triggering a download.
- `?dl=<token>` (8–32 lowercase letters or digits): the response also sets the cookie `ytx_dl_<token>=1` (Max-Age 120, Path=/, SameSite=Lax). The page sees it only once the browser has received this response, which is how it confirms the download really started.

## Health

- `GET /healthz`: liveness.
- `GET /readyz`: temporary directory writable with free space, FFmpeg present, extractor importable (`503` otherwise).
- `GET /internal/stats`: counters per platform, backend and outcome. Loopback only; never proxied.
