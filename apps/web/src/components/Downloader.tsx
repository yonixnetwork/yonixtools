"use client";
import { CircleAlert, CircleCheck, ClipboardPaste, Clock, Download, Info, Link as LinkIcon, LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PlatformIcon } from "./Icon";
import { detectUrl, PLATFORMS } from "@/lib/downloader/detect";
import { createJob, DownloaderError, extractMedia, getJob, jobReady, resolveDownloadUrl, type ExtractResult, type MediaFormat } from "@/lib/downloader/client";
import { site } from "@/lib/site";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "not-configured"; platform: string; contentType: string }
  | { kind: "error"; title: string; message: string }
  | { kind: "result"; data: ExtractResult; url: string };

type JobState = { key: string; status: "working"; progress?: number } | { key: string; status: "ready"; href: string } | { key: string; status: "failed"; message: string };

const POLL_MS = 1500;
const POLL_LIMIT_MS = 10 * 60_000;

function errorTitle(e: DownloaderError) {
  const p = e.platform ? (PLATFORMS[e.platform as keyof typeof PLATFORMS]?.name ?? e.platform) : null;
  return p ? `${p} extraction failed` : "Download failed";
}

function formatSize(bytes?: number) {
  if (!bytes) return "";
  const mb = bytes / 1_000_000;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} kB`;
}

export function Downloader({ expectedPlatform, autoFocus }: { expectedPlatform?: string; autoFocus?: boolean }) {
  const [value, setValue] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const [job, setJob] = useState<JobState | null>(null);
  const [canPaste, setCanPaste] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelled = useRef(false);
  const detection = useMemo(() => (value.trim() ? detectUrl(value) : null), [value]);
  const api = { baseUrl: site.downloaderApiUrl };

  useEffect(() => {
    setCanPaste(typeof navigator !== "undefined" && !!navigator.clipboard?.readText);
    document.documentElement.dataset.downloaderReady = "1";
    return () => {
      cancelled.current = true;
    };
  }, []);

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setValue(text.trim());
      inputRef.current?.focus();
    } catch {
      inputRef.current?.focus();
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setJob(null);
    const d = detectUrl(value);
    if (!d.ok) {
      setState({ kind: "error", title: d.reason === "empty" ? "Paste a link first" : d.platform ? `${d.platform.name} link not supported` : "Link not supported", message: d.message });
      return;
    }
    if (!site.downloaderApiUrl) {
      setState({ kind: "not-configured", platform: d.platform.name, contentType: d.contentType });
      return;
    }
    setState({ kind: "loading" });
    try {
      const data = await extractMedia(api, d.url);
      setState({ kind: "result", data, url: d.url });
    } catch (err) {
      const e2 = err instanceof DownloaderError ? err : new DownloaderError("server_error", "Something went wrong. Nothing was downloaded.");
      setState({ kind: "error", title: errorTitle(e2.platform ? e2 : new DownloaderError(e2.code, e2.message, d.platform.id)), message: e2.message });
    }
  };

  const startJob = async (url: string, itemIndex: number, f: MediaFormat) => {
    const key = `${itemIndex}:${f.id}`;
    setJob({ key, status: "working" });
    try {
      let j = await createJob(api, url, itemIndex, f.id);
      const started = Date.now();
      while (!cancelled.current && (j.status === "queued" || j.status === "running")) {
        setJob({ key, status: "working", progress: j.progress });
        if (Date.now() - started > POLL_LIMIT_MS) throw new DownloaderError("timeout", "The download took too long and was stopped.");
        await new Promise((r) => setTimeout(r, POLL_MS));
        j = await getJob(api, j.id);
      }
      if (jobReady(j)) setJob({ key, status: "ready", href: resolveDownloadUrl(site.downloaderApiUrl, j.downloadUrl) });
      else setJob({ key, status: "failed", message: j.error?.message || (j.status === "expired" ? "The file expired. Start the download again." : "The download failed. Nothing was saved.") });
    } catch (err) {
      setJob({ key, status: "failed", message: err instanceof DownloaderError ? err.message : "The download failed. Nothing was saved." });
    }
  };

  const expected = expectedPlatform ? PLATFORMS[expectedPlatform as keyof typeof PLATFORMS] : undefined;

  return (
    <div className="downloader" id="downloader">
      <form className="dl-form" onSubmit={submit} noValidate>
        <label htmlFor="dl-url" className="sr-only">
          Paste a {expected ? expected.name : "social media"} link
        </label>
        <div className="dl-input-wrap">
          <LinkIcon aria-hidden />
          <input
            ref={inputRef}
            id="dl-url"
            className="dl-input"
            type="url"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            autoFocus={autoFocus}
            placeholder={expected ? `Paste a ${expected.name} link…` : "Paste a link from Instagram, TikTok, YouTube…"}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (state.kind !== "idle" && state.kind !== "loading") setState({ kind: "idle" });
            }}
            aria-describedby="dl-detect"
          />
          {canPaste && !value && (
            <button type="button" className="btn btn-sm btn-ghost dl-paste" onClick={paste}>
              <ClipboardPaste aria-hidden /> Paste
            </button>
          )}
        </div>
        <button type="submit" className="btn btn-primary dl-submit" disabled={state.kind === "loading"}>
          {state.kind === "loading" ? <LoaderCircle className="spin" aria-hidden /> : <Download aria-hidden />}
          {state.kind === "loading" ? "Fetching…" : "Download"}
        </button>
      </form>

      <div className="dl-detect" id="dl-detect" aria-live="polite">
        {!detection && <span>Works with public posts. The platform is detected automatically, so you don't need to choose it.</span>}
        {detection?.ok && (
          <span className="ok">
            <span style={{ width: 16, height: 16, display: "inline-block" }}>
              <PlatformIcon platform={detection.platform.id} />
            </span>
            {detection.platform.name} · {detection.contentType} detected
          </span>
        )}
        {detection?.ok && expected && detection.platform.id !== expected.id && <span>The downloader handles every supported platform, so this link works here too.</span>}
        {detection && !detection.ok && detection.reason !== "empty" && (
          <span className="warn">
            <CircleAlert aria-hidden />
            {detection.message}
          </span>
        )}
      </div>

      {!site.downloaderApiUrl && state.kind === "idle" && (
        <p className="dl-detect dl-status" style={{ marginTop: 4 }} data-testid="dl-status">
          <Clock aria-hidden />
          Link detection is live now. Downloading turns on when the YoniXTools download service launches.
        </p>
      )}

      {state.kind === "not-configured" && (
        <div className="notice notice-warn" role="status">
          <Info aria-hidden />
          <div>
            <strong>Downloading is not live yet</strong>
            We recognised this {state.platform} {state.contentType.toLowerCase()} link, but the YoniXTools download service is still being built and has not been deployed. Nothing was downloaded.
          </div>
        </div>
      )}

      {state.kind === "error" && (
        <div className="notice notice-error" role="alert">
          <CircleAlert aria-hidden />
          <div>
            <strong>{state.title}</strong>
            {state.message}
          </div>
        </div>
      )}

      {state.kind === "result" && (
        <div className="card card-pad media-result" style={{ marginTop: 16 }}>
          {state.data.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="media-thumb" src={state.data.thumbnail} alt="" referrerPolicy="no-referrer" loading="lazy" onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
          ) : (
            <div className="media-thumb" />
          )}
          <div style={{ minWidth: 0 }}>
            <h3 style={{ overflowWrap: "anywhere" }}>{state.data.title}</h3>
            {state.data.author && <p className="muted">{state.data.author}</p>}
            {state.data.items.map((item) => (
              <div key={item.index} className="format-list">
                {state.data.items.length > 1 && <div className="field-label">Item {item.index + 1} · {item.kind}</div>}
                {item.formats.map((f) => {
                  const key = `${item.index}:${f.id}`;
                  const mine = job?.key === key ? job : null;
                  return (
                    <div key={f.id} className="format-item">
                      <span>
                        <strong>{f.label}</strong> <span className="muted">{[f.ext.toUpperCase(), formatSize(f.filesize)].filter(Boolean).join(" · ")}</span>
                      </span>
                      {mine?.status === "ready" ? (
                        <a className="btn btn-sm btn-primary" href={mine.href} download>
                          <CircleCheck aria-hidden /> Save file
                        </a>
                      ) : (
                        <button type="button" className="btn btn-sm" disabled={job?.status === "working"} onClick={() => startJob(state.url, item.index, f)}>
                          {mine?.status === "working" ? <LoaderCircle className="spin" aria-hidden /> : <Download aria-hidden />}
                          {mine?.status === "working" ? (mine.progress != null ? `${Math.round(mine.progress)}%` : "Preparing…") : "Download"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            {job?.status === "failed" && (
              <div className="notice notice-error" role="alert">
                <CircleAlert aria-hidden />
                <div>
                  <strong>Download failed</strong>
                  {job.message}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
