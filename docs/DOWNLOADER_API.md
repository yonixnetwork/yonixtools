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

Response `200` (an Instagram carousel with one video and one image):

```json
{
  "platform": "instagram", "mediaType": "mixed", "title": "Post by nasa", "author": "…", "thumbnail": "/v1/preview/3f…", "durationSeconds": null,
  "items": [
    { "index": 0, "kind": "video", "thumbnail": "/v1/preview/9a…", "durationSeconds": 31,
      "formats": [{ "id": "v:best", "label": "Best quality (1080p) · MP4", "ext": "mp4", "kind": "video", "filesize": 9500000 },
                  { "id": "v:720", "label": "720p · MP4", "ext": "mp4", "kind": "video" },
                  { "id": "a:best", "label": "Audio only · M4A (original)", "ext": "m4a", "kind": "audio" },
                  { "id": "a:mp3", "label": "Audio only · MP3 (converted)", "ext": "mp3", "kind": "audio" }] },
    { "index": 1, "kind": "image", "thumbnail": "/v1/preview/c2…", "width": 1080, "height": 1350, "conversions": ["jpg", "png", "webp"],
      "formats": [{ "id": "i:best", "label": "Original · 1080×1350 · JPG", "ext": "jpg", "kind": "image" },
                  { "id": "i:640", "label": "640×800 · JPG (smaller copy from Instagram)", "ext": "jpg", "kind": "image" }] }
  ]
}
```

- **`mediaType`:** `video` | `videos` | `image` | `images` | `audio` | `mixed`.
- **Size choices** (`i:<width>`) appear only when the platform really serves several copies. Otherwise an image has just `i:best`, labelled "Original".
- **MP3** (`a:mp3`) is offered only when the source is known to contain audio, and never when the original is already MP3.
- **Format ids** are opaque. They match `^(v:(best|\d{3,4})|a:(best|mp3)|i:(best|\d{2,5})|f:best|g:\d{1,3})(~(jpg|png|webp))?$`. A job may use only ids that extraction returned. The `~jpg|png|webp` suffix (FFmpeg conversion) is accepted for image items only.
- Results are cached for 10 minutes.
- Source URLs found during extraction stay on the server. Images are later downloaded from exactly those URLs, so there is no second platform request.

## `GET /v1/preview/{token}`

Thumbnail for an extracted item, served same-origin, because many CDNs refuse to be embedded on other sites. It works like this:

- **Tokens:** opaque, and created only by extraction; they map server-side to a URL the extractor reported, never to a user URL.
- **Fetching:** https only, with redirects followed manually (4 at most), through the socket guard. A proxy is never used.
- **Response:** `image/*` only (no SVG), at most 6 MB, sent with `Cache-Control: private, max-age=900`.
- **Failures:** any failure returns `404`.

## `POST /v1/jobs` → `202`

- **One item:** `{"url": "…", "itemIndex": 1, "formatId": "i:best~png"}`.
- **ZIP of several items:** `{"url": "…", "formatId": "zip", "items": [1, 2, 3]}`.
  - It takes 2 to 20 distinct item indexes.
  - The archive holds the best copy of each item, named `<platform>-NN.ext`. Files are stored, not recompressed.
  - The total is capped at the file size limit.

Unless noted, the rest of this section describes single-item jobs:

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
