/**
 * Browser client for the separate downloader backend.
 *
 * The contract is documented in docs/DOWNLOADER_API.md. Every non-2xx
 * response, network failure, timeout or malformed body becomes a typed
 * DownloaderError; this module never produces a "success" result unless the
 * backend returned a well-formed success payload.
 */

import type { Translator } from "@/i18n/translator";

export interface MediaFormat {
  id: string;
  label: string;
  ext: string;
  kind: "video" | "audio" | "image";
  filesize?: number;
}

export interface MediaItem {
  index: number;
  kind: "video" | "image" | "audio";
  /** Preview URL relative to the API base (served same-origin by the backend). */
  thumbnail?: string;
  formats: MediaFormat[];
  durationSeconds?: number;
  width?: number;
  height?: number;
  /** Image items: formats the original can be converted to on request. */
  conversions?: Array<"jpg" | "png" | "webp">;
}

export type MediaType = "video" | "videos" | "image" | "images" | "audio" | "mixed";

export interface ExtractResult {
  platform: string;
  /** What the link really contains (older backends omit it). */
  mediaType?: MediaType;
  title: string;
  author?: string;
  thumbnail?: string;
  durationSeconds?: number;
  items: MediaItem[];
}

/** Mirrors services/downloader/app/errors.py plus client-side codes. */
export type ErrorCode =
  | "not_configured"
  | "network"
  | "invalid_response"
  | "invalid_request"
  | "unsupported_url"
  | "unsupported_content"
  | "unsafe_url"
  | "unavailable"
  | "private"
  | "login_required"
  | "age_restricted"
  | "geo_blocked"
  | "drm_protected"
  | "live_stream"
  | "too_large"
  | "too_long"
  | "no_media"
  | "invalid_format"
  | "not_found"
  | "expired"
  | "payload_too_large"
  | "rate_limited"
  | "busy"
  | "platform_blocked"
  | "network_error"
  | "extractor_failed"
  | "timeout"
  | "server_error";

/**
 * `message` is English, for logs only. Show errorMessage(t, err) from ./error-message instead:
 * it picks the catalogue text by `key` (client-produced errors), `platform` + `code`, or `code`.
 */
export class DownloaderError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public platform?: string,
    /** "errors" catalogue key when the client produced the error (wording differs from the backend's). */
    public key?: string,
  ) {
    super(message);
    this.name = "DownloaderError";
  }
}

/** English text of client-produced errors (logs only; the UI uses the "errors" catalogue). */
const FRIENDLY: Partial<Record<ErrorCode, string>> = {
  network: "Couldn't reach the download service. Check your connection and try again.",
  timeout: "The download service took too long to respond. Try again in a moment.",
  invalid_response: "The download service sent an unexpected response. Nothing was downloaded.",
  rate_limited: "Too many requests in a short time. Wait a minute and try again.",
  server_error: "The download service had a problem. Nothing was downloaded.",
};

/** "errors" catalogue keys for FRIENDLY (codes the backend also uses get a client.* key: different wording). */
const FRIENDLY_KEY: Partial<Record<ErrorCode, string>> = {
  network: "code.network",
  invalid_response: "code.invalid_response",
  timeout: "client.timeout",
  rate_limited: "client.rate_limited",
  server_error: "client.server_error",
};

const clientError = (code: ErrorCode) => new DownloaderError(code, FRIENDLY[code] ?? FRIENDLY.server_error!, undefined, FRIENDLY_KEY[code] ?? "client.server_error");

export interface ClientOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

async function request<T>(opts: ClientOptions, path: string, init: RequestInit, validate: (b: unknown) => b is T): Promise<T> {
  if (!opts.baseUrl) throw new DownloaderError("not_configured", "The downloader service is not connected yet.", undefined, "code.not_configured");
  const f = opts.fetchImpl ?? fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 45_000);
  let res: Response;
  try {
    res = await f(`${opts.baseUrl}${path}`, { ...init, signal: ctrl.signal, headers: { "content-type": "application/json", ...(init.headers || {}) } });
  } catch (e) {
    throw clientError((e as Error)?.name === "AbortError" ? "timeout" : "network");
  } finally {
    clearTimeout(timer);
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw clientError(res.ok ? "invalid_response" : "server_error");
  }
  if (!res.ok) {
    const err = (body as { error?: { code?: string; message?: string; platform?: string } })?.error;
    if (!err?.code) throw clientError(res.status === 429 ? "rate_limited" : "server_error");
    const code = err.code as ErrorCode;
    // The backend's code (and platform) select the catalogue message; its English text is kept for logs.
    throw new DownloaderError(code, err.message || FRIENDLY[code] || FRIENDLY.server_error!, err.platform);
  }
  if (!validate(body)) throw clientError("invalid_response");
  return body;
}

function isExtractResult(b: unknown): b is ExtractResult {
  const r = b as ExtractResult;
  return (
    !!r &&
    typeof r.platform === "string" &&
    typeof r.title === "string" &&
    Array.isArray(r.items) &&
    r.items.length > 0 &&
    r.items.every((i) => Array.isArray(i.formats) && i.formats.length > 0 && i.formats.every((f) => typeof f.id === "string" && typeof f.label === "string"))
  );
}

export function extractMedia(opts: ClientOptions, url: string): Promise<ExtractResult> {
  return request(opts, "/v1/extract", { method: "POST", body: JSON.stringify({ url }) }, isExtractResult);
}

export interface Job {
  id: string;
  status: "queued" | "running" | "done" | "failed" | "expired";
  platform?: string;
  progress?: number;
  /** queued → downloading → processing → ready (older backends omit it). */
  phase?: "queued" | "downloading" | "processing" | "ready";
  /** Show errorMessage(t, { code, platform }) (./error-message), not `message` (English). */
  error?: { code: ErrorCode; message: string; platform?: string };
  /** Path relative to the API base (e.g. "/v1/jobs/{id}/file") or an absolute URL. */
  downloadUrl?: string;
  filesize?: number;
}

/** Turn a job's downloadUrl into something the browser can open. */
export function resolveDownloadUrl(baseUrl: string, downloadUrl: string): string {
  if (/^https?:\/\//i.test(downloadUrl)) return downloadUrl;
  return `${baseUrl}${downloadUrl.startsWith("/") ? "" : "/"}${downloadUrl}`;
}

function isJob(b: unknown): b is Job {
  const j = b as Job;
  return !!j && typeof j.id === "string" && ["queued", "running", "done", "failed", "expired"].includes(j.status);
}

export function createJob(opts: ClientOptions, url: string, itemIndex: number, formatId: string): Promise<Job> {
  return request(opts, "/v1/jobs", { method: "POST", body: JSON.stringify({ url, itemIndex, formatId }) }, isJob);
}

/** One ZIP with the best copy of each selected item of a post (2 or more items). */
export function createZipJob(opts: ClientOptions, url: string, items: number[]): Promise<Job> {
  return request(opts, "/v1/jobs", { method: "POST", body: JSON.stringify({ url, formatId: "zip", items }) }, isJob);
}

/** Describe a result's content in words ("Video", "3 images", "Mixed: 1 video, 2 images"). English; the UI uses describeMediaText. */
export function describeMedia(r: Pick<ExtractResult, "items">): string {
  const n = (k: string) => r.items.filter((i) => i.kind === k).length;
  const v = n("video"), i = n("image"), a = n("audio");
  const part = (c: number, w: string) => (c ? `${c} ${w}${c > 1 ? "s" : ""}` : "");
  if ([v, i, a].filter(Boolean).length > 1) return `Mixed: ${[part(v, "video"), part(i, "image"), part(a, "audio track")].filter(Boolean).join(", ")}`;
  if (a) return a > 1 ? part(a, "audio track") : "Audio";
  if (i) return i > 1 ? part(i, "image") : "Image";
  return v > 1 ? part(v, "video") : "Video";
}

/** describeMedia in the visitor's language, with a translator for the "downloader" namespace. */
export function describeMediaText(t: Translator, r: Pick<ExtractResult, "items">): string {
  const n = (k: string) => r.items.filter((i) => i.kind === k).length;
  const counts: Array<[string, number]> = [["video", n("video")], ["image", n("image")], ["audio", n("audio")]];
  const present = counts.filter(([, c]) => c > 0);
  if (present.length > 1) {
    const parts = present.map(([k, c]) => t(`media.count.${k}`, { count: c }));
    return t("media.mixed", { parts: new Intl.ListFormat(t.locale, { type: "unit", style: "short" }).format(parts) });
  }
  const [k, c] = present[0] ?? ["video", 0];
  return c > 1 ? t(`media.count.${k}`, { count: c }) : t(`media.single.${k}`);
}

export function getJob(opts: ClientOptions, id: string): Promise<Job> {
  return request(opts, `/v1/jobs/${encodeURIComponent(id)}`, { method: "GET" }, isJob);
}

/** A job only counts as downloadable when it is done AND has a download URL. */
export function jobReady(job: Job): job is Job & { downloadUrl: string } {
  return job.status === "done" && typeof job.downloadUrl === "string" && job.downloadUrl.length > 0;
}
