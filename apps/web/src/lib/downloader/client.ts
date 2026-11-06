/**
 * Browser client for the separate downloader backend.
 *
 * The contract is documented in docs/DOWNLOADER_API.md. Every non-2xx
 * response, network failure, timeout or malformed body becomes a typed
 * DownloaderError; this module never produces a "success" result unless the
 * backend returned a well-formed success payload.
 */

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
  thumbnail?: string;
  formats: MediaFormat[];
}

export interface ExtractResult {
  platform: string;
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

export class DownloaderError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public platform?: string,
  ) {
    super(message);
    this.name = "DownloaderError";
  }
}

const FRIENDLY: Partial<Record<ErrorCode, string>> = {
  network: "Couldn't reach the download service. Check your connection and try again.",
  timeout: "The download service took too long to respond. Try again in a moment.",
  invalid_response: "The download service sent an unexpected response. Nothing was downloaded.",
  rate_limited: "Too many requests in a short time. Wait a minute and try again.",
  server_error: "The download service had a problem. Nothing was downloaded.",
};

export interface ClientOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

async function request<T>(opts: ClientOptions, path: string, init: RequestInit, validate: (b: unknown) => b is T): Promise<T> {
  if (!opts.baseUrl) throw new DownloaderError("not_configured", "The downloader service is not connected yet.");
  const f = opts.fetchImpl ?? fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 45_000);
  let res: Response;
  try {
    res = await f(`${opts.baseUrl}${path}`, { ...init, signal: ctrl.signal, headers: { "content-type": "application/json", ...(init.headers || {}) } });
  } catch (e) {
    throw new DownloaderError((e as Error)?.name === "AbortError" ? "timeout" : "network", FRIENDLY[(e as Error)?.name === "AbortError" ? "timeout" : "network"]!);
  } finally {
    clearTimeout(timer);
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new DownloaderError(res.ok ? "invalid_response" : "server_error", FRIENDLY[res.ok ? "invalid_response" : "server_error"]!);
  }
  if (!res.ok) {
    const err = (body as { error?: { code?: string; message?: string; platform?: string } })?.error;
    const code = (err?.code as ErrorCode) || (res.status === 429 ? "rate_limited" : "server_error");
    throw new DownloaderError(code, err?.message || FRIENDLY[code] || FRIENDLY.server_error!, err?.platform);
  }
  if (!validate(body)) throw new DownloaderError("invalid_response", FRIENDLY.invalid_response!);
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
  error?: { code: ErrorCode; message: string };
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

export function getJob(opts: ClientOptions, id: string): Promise<Job> {
  return request(opts, `/v1/jobs/${encodeURIComponent(id)}`, { method: "GET" }, isJob);
}

/** A job only counts as downloadable when it is done AND has a download URL. */
export function jobReady(job: Job): job is Job & { downloadUrl: string } {
  return job.status === "done" && typeof job.downloadUrl === "string" && job.downloadUrl.length > 0;
}
