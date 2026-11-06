# Downloader API contract (draft for Phase 2)

The frontend (`apps/web/src/lib/downloader/client.ts`) is written against this contract. The backend is
not built yet. Until `NEXT_PUBLIC_DOWNLOADER_API_URL` is set, the UI makes **no** requests and tells the user
that downloading is not live.

All responses are JSON. Errors always use:

```json
{ "error": { "code": "private", "message": "This Instagram post is private.", "platform": "instagram" } }
```

`code` ∈ `unsupported_url | unavailable | private | rate_limited | too_large | extractor_failed | timeout | server_error`.
`platform` names the adapter that failed, so the UI can say "Instagram extraction failed".

## POST /v1/extract

Request: `{ "url": "https://www.instagram.com/reel/…" }`

Response 200:

```json
{
  "platform": "instagram",
  "title": "…",
  "author": "…",
  "thumbnail": "https://…",
  "durationSeconds": 31,
  "items": [
    { "index": 0, "kind": "video", "thumbnail": "…",
      "formats": [ { "id": "hd", "label": "1080p MP4", "ext": "mp4", "kind": "video", "filesize": 8123456 } ] }
  ]
}
```

A 200 response with no items, or items without formats, is treated by the client as a failure.

## POST /v1/jobs

Request: `{ "url": "…", "itemIndex": 0, "formatId": "hd" }` → `{ "id": "…", "status": "queued" }`

## GET /v1/jobs/{id}

`{ "id": "…", "status": "queued|running|done|failed|expired", "progress": 42, "downloadUrl": "https://…/v1/jobs/{id}/file", "error": { … } }`

The client only offers "Save file" when `status == "done"` **and** `downloadUrl` is present.

## Backend requirements carried into Phase 2

- An adapter per platform behind `detect(url)`. yt-dlp is the generic fallback, restricted to an allowlist.
- SSRF protection: a domain allowlist, plus a check that resolved IPs are public unicast on every redirect hop.
  No user-controlled proxying.
- A bounded job queue with per-IP rate limits, size and time limits, temp directories per job, and TTL cleanup.
- No cookies or logins, and no DRM or private-content bypass.
