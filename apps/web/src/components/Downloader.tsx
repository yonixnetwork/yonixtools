"use client";
import { Check, CircleAlert, CircleCheck, ClipboardPaste, Clock, Copy, Download, FileArchive, Image as ImageIcon, Info, Link as LinkIcon, LoaderCircle, Music, RotateCcw, Video, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PlatformIcon } from "./Icon";
import { detectUrl, PLATFORMS } from "@/lib/downloader/detect";
import { createJob, createZipJob, describeMedia, DownloaderError, extractMedia, getJob, jobReady, resolveDownloadUrl, type ExtractResult, type MediaFormat, type MediaItem } from "@/lib/downloader/client";
import { startBrowserDownload } from "@/lib/downloader/browser-download";
import { readPreferredFormat, savePreferredFormat } from "@/lib/downloader/history";
import { ACTIVE_PHASES, jobPhase, phaseText, type Phase } from "@/lib/downloader/phases";
import { site } from "@/lib/site";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "not-configured"; platform: string; contentType: string }
  | { kind: "error"; title: string; message: string; retry: boolean }
  | ResultState;

/**
 * One quality the user clicked. Transfers outlive the result card: "Download
 * another video" never cancels them, they finish and start in the background.
 */
interface Transfer {
  key: string; // `${resultId}:${itemIndex}:${formatId}` or `${resultId}:zip:${items}`
  resultId: number;
  title: string;
  platform: string;
  label: string;
  url: string;
  itemIndex: number;
  formatId: string;
  phase: Phase;
  progress?: number;
  href?: string;
  message?: string;
  zipItems?: number[];
}

type ResultState = { kind: "result"; data: ExtractResult; url: string; resultId: number };

const POLL_MS = 1200;
const POLL_LIMIT_MS = 10 * 60_000;
const ACTIVE = ACTIVE_PHASES;

function platformName(id?: string) {
  return id ? (PLATFORMS[id as keyof typeof PLATFORMS]?.name ?? id) : "";
}

function formatSize(bytes?: number) {
  if (!bytes) return "";
  const mb = bytes / 1_000_000;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} kB`;
}

function formatDuration(s?: number) {
  if (!s) return "";
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.round(s % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}

export function Downloader({ expectedPlatform, autoFocus }: { expectedPlatform?: string; autoFocus?: boolean }) {
  const [value, setValue] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [preferred, setPreferred] = useState<string | null>(null);
  const [canPaste, setCanPaste] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const unmounted = useRef(false);
  const resultSeq = useRef(0);
  const detection = useMemo(() => (value.trim() ? detectUrl(value) : null), [value]);
  const api = useMemo(() => ({ baseUrl: site.downloaderApiUrl }), []);

  useEffect(() => {
    unmounted.current = false;
    setCanPaste(typeof navigator !== "undefined" && !!navigator.clipboard?.readText);
    setPreferred(readPreferredFormat());
    document.documentElement.dataset.downloaderReady = "1";
    return () => {
      unmounted.current = true;
    };
  }, []);

  const patch = useCallback((key: string, p: Partial<Transfer>) => {
    if (unmounted.current) return;
    setTransfers((ts) => ts.map((t) => (t.key === key ? { ...t, ...p } : t)));
  }, []);

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setValue(text.trim());
    } catch {
      /* permission denied: the user can still paste manually */
    }
    inputRef.current?.focus();
  };

  const clearInput = () => {
    setValue("");
    if (state.kind !== "loading") setState({ kind: "idle" });
    inputRef.current?.focus();
  };

  /** Reset everything for the next link. Transfers already started keep running. */
  const another = () => {
    setValue("");
    setState({ kind: "idle" });
    setCopied(false);
    inputRef.current?.focus();
    inputRef.current?.scrollIntoView?.({ block: "center", behavior: "smooth" });
  };

  const fetchInfo = async (raw: string) => {
    const d = detectUrl(raw);
    if (!d.ok) {
      setState({ kind: "error", title: d.reason === "empty" ? "Paste a link first" : d.platform ? `${d.platform.name} link not supported` : "Link not supported", message: d.message, retry: false });
      return;
    }
    if (!site.downloaderApiUrl) {
      setState({ kind: "not-configured", platform: d.platform.name, contentType: d.contentType });
      return;
    }
    setState({ kind: "loading" });
    setCopied(false);
    try {
      const data = await extractMedia(api, d.url);
      setThumbFailed(false);
      setSelected([]);
      setState({ kind: "result", data, url: d.url, resultId: ++resultSeq.current });
    } catch (err) {
      const e2 = err instanceof DownloaderError ? err : new DownloaderError("server_error", "Something went wrong. Nothing was downloaded.");
      const name = platformName(e2.platform || d.platform.id);
      const retry = !["unsupported_url", "unsupported_content", "unsafe_url", "private", "login_required", "drm_protected", "live_stream", "too_large", "too_long", "age_restricted", "geo_blocked", "not_found", "no_media"].includes(e2.code);
      setState({ kind: "error", title: name ? `${name} extraction failed` : "Download failed", message: e2.message, retry });
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void fetchInfo(value);
  };

  const run = async (t: Transfer) => {
    try {
      let j = t.zipItems ? await createZipJob(api, t.url, t.zipItems) : await createJob(api, t.url, t.itemIndex, t.formatId);
      const started = Date.now();
      while (!unmounted.current && (j.status === "queued" || j.status === "running")) {
        patch(t.key, { phase: jobPhase(j), progress: j.progress });
        if (Date.now() - started > POLL_LIMIT_MS) throw new DownloaderError("timeout", "The download took too long and was stopped.");
        await new Promise((r) => setTimeout(r, POLL_MS));
        j = await getJob(api, j.id);
      }
      if (unmounted.current) return;
      if (!jobReady(j)) {
        patch(t.key, { phase: "failed", message: j.error?.message || (j.status === "expired" ? "The file expired. Choose the quality again." : "The download failed. Nothing was saved.") });
        return;
      }
      const href = resolveDownloadUrl(site.downloaderApiUrl, j.downloadUrl);
      patch(t.key, { phase: "starting", href, progress: 100 });
      const outcome = await startBrowserDownload(href);
      patch(t.key, { phase: outcome });
    } catch (err) {
      patch(t.key, { phase: "failed", message: err instanceof Error && err.message ? err.message : "The download failed. Nothing was saved." });
    }
  };

  const start = (t: Transfer) => {
    setTransfers((ts) => [t, ...ts.filter((x) => x.key !== t.key)].slice(0, 16));
    void run(t);
  };

  /** One click on a quality (or an image's Download button) starts the download. */
  const choose = (result: ResultState, itemIndex: number, formatId: string, label: string) => {
    start({ key: `${result.resultId}:${itemIndex}:${formatId}`, resultId: result.resultId, title: result.data.title, platform: result.data.platform, label, url: result.url, itemIndex, formatId, phase: "queued" });
    if (!formatId.includes("~")) {
      savePreferredFormat(formatId);
      setPreferred(readPreferredFormat());
    }
  };

  const chooseZip = (result: ResultState, items: number[]) => {
    const sorted = [...items].sort((a, b) => a - b);
    start({ key: `${result.resultId}:zip:${sorted.join(",")}`, resultId: result.resultId, title: result.data.title, platform: result.data.platform, label: `ZIP of ${sorted.length} items`, url: result.url, itemIndex: sorted[0], formatId: "zip", zipItems: sorted, phase: "queued" });
  };

  const transferFor = (result: ResultState, key: string) => transfers.find((x) => x.key === `${result.resultId}:${key}`);

  const copyInfo = async (r: ResultState) => {
    const formats = r.data.items.flatMap((i) => i.formats.map((f) => f.label));
    const text = [r.data.title, r.data.author && `By ${r.data.author}`, `Platform: ${platformName(r.data.platform)}`, r.data.durationSeconds && `Duration: ${formatDuration(r.data.durationSeconds)}`, `Available: ${[...new Set(formats)].join(", ")}`, r.url]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => !unmounted.current && setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  };

  const expected = expectedPlatform ? PLATFORMS[expectedPlatform as keyof typeof PLATFORMS] : undefined;
  const current = state.kind === "result" ? state : null;
  // Only downloads still being prepared (or needing a manual save) from earlier links; no history list.
  const background = transfers.filter((t) => t.resultId !== current?.resultId && (ACTIVE.includes(t.phase) || t.phase === "requested"));
  const api_base = site.downloaderApiUrl;
  const preview = (u?: string) => (u ? resolveDownloadUrl(api_base, u) : undefined);

  return (
    <div className="downloader" id="downloader" data-ytx-media-input="">
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
            placeholder={expected ? `Paste a ${expected.name} link…` : "Paste a link from TikTok, Instagram, Facebook…"}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (state.kind === "error" || state.kind === "not-configured") setState({ kind: "idle" });
            }}
            aria-describedby="dl-detect"
          />
          {value ? (
            <button type="button" className="btn btn-sm btn-ghost dl-paste dl-clear" onClick={clearInput} aria-label="Clear link">
              <X aria-hidden />
            </button>
          ) : (
            canPaste && (
              <button type="button" className="btn btn-sm btn-ghost dl-paste" onClick={paste}>
                <ClipboardPaste aria-hidden /> Paste
              </button>
            )
          )}
        </div>
        <button type="submit" className="btn btn-primary dl-submit" disabled={state.kind === "loading"}>
          {state.kind === "loading" ? <LoaderCircle className="spin" aria-hidden /> : <Download aria-hidden />}
          {state.kind === "loading" ? "Fetching…" : "Download"}
        </button>
      </form>

      <div className="dl-detect" id="dl-detect" aria-live="polite">
        {!detection && <span>Public posts only. The platform is detected automatically.</span>}
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

      {state.kind === "loading" && (
        <div className="card card-pad media-result dl-skeleton" aria-busy="true" aria-label="Fetching media details">
          <div className="sk sk-thumb" />
          <div>
            <div className="sk sk-line" style={{ width: "70%" }} />
            <div className="sk sk-line" style={{ width: "40%" }} />
            <div className="sk sk-row" />
            <div className="sk sk-row" />
          </div>
        </div>
      )}

      {state.kind === "not-configured" && (
        <div className="notice notice-warn" role="status">
          <Info aria-hidden />
          <div>
            <strong>Downloading is not live yet</strong>
            We recognised this {state.platform} {state.contentType.toLowerCase()} link, but the YoniXTools download service is not connected. Nothing was downloaded.
          </div>
        </div>
      )}

      {state.kind === "error" && (
        <div className="notice notice-error" role="alert">
          <CircleAlert aria-hidden />
          <div>
            <strong>{state.title}</strong>
            {state.message}
            {state.retry && (
              <div className="dl-actions">
                <button type="button" className="btn btn-sm" onClick={() => fetchInfo(value)}>
                  <RotateCcw aria-hidden /> Try again
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {current && (
        <div className="card card-pad dl-result" data-media-type={current.data.mediaType ?? ""}>
          <div className={`media-result${!current.data.thumbnail || thumbFailed || current.data.items.length > 1 || current.data.items[0]?.kind === "image" ? " no-thumb" : ""}`}>
            {current.data.thumbnail && !thumbFailed && current.data.items.length === 1 && current.data.items[0].kind !== "image" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="media-thumb" src={preview(current.data.thumbnail)} alt="" loading="lazy" onError={() => setThumbFailed(true)} />
            )}
            <div style={{ minWidth: 0 }}>
              <h3 style={{ overflowWrap: "anywhere" }}>{current.data.title}</h3>
              <p className="muted dl-meta">
                <span style={{ width: 14, height: 14, display: "inline-block" }}>
                  <PlatformIcon platform={current.data.platform} />
                </span>
                {[platformName(current.data.platform), current.data.author, formatDuration(current.data.durationSeconds)].filter(Boolean).join(" · ")}
                <span className="badge badge-neutral" data-testid="media-kind">{describeMedia(current.data)}</span>
              </p>
              {current.data.items.length === 1 && current.data.items[0].kind !== "image" && (
                <>
                  <p className="dl-hint">Choose a quality. The download starts right away.</p>
                  <FormatList item={current.data.items[0]} result={current} transferFor={transferFor} choose={choose} preferred={preferred} />
                </>
              )}
            </div>
          </div>

          {current.data.items.length === 1 && current.data.items[0].kind === "image" && (
            <div className="media-grid single">
              <MediaCard item={current.data.items[0]} result={current} preview={preview} transferFor={transferFor} choose={choose} />
            </div>
          )}

          {current.data.items.length > 1 && (
            <>
              <div className="bulk-bar">
                <span className="muted">Choose what to save. Each item downloads on its own, or select several for one ZIP.</span>
                <span className="bulk-actions">
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => setSelected(selected.length === current.data.items.length ? [] : current.data.items.map((i) => i.index))}>
                    {selected.length === current.data.items.length ? "Clear selection" : "Select all"}
                  </button>
                  <ZipButton result={current} selected={selected} transferFor={transferFor} chooseZip={chooseZip} />
                </span>
              </div>
              <div className="media-grid">
                {current.data.items.map((item) => (
                  <MediaCard key={item.index} item={item} result={current} preview={preview} transferFor={transferFor} choose={choose}
                    selected={selected.includes(item.index)} onSelect={(on) => setSelected((s) => (on ? [...s, item.index] : s.filter((x) => x !== item.index)))} />
                ))}
              </div>
            </>
          )}

          {transfers
            .filter((t) => t.resultId === current.resultId && t.phase === "failed")
            .slice(0, 1)
            .map((t) => (
              <div key={t.key} className="notice notice-error" role="alert">
                <CircleAlert aria-hidden />
                <div>
                  <strong>Download failed</strong>
                  {t.message}
                </div>
              </div>
            ))}
          <div className="dl-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={another}>
              <RotateCcw aria-hidden /> Download another video
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => copyInfo(current)}>
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {copied ? "Copied" : "Copy media info"}
            </button>
          </div>
        </div>
      )}

      {background.length > 0 && (
        <div className="card card-pad dl-background" aria-live="polite">
          <div className="field-label">Your downloads</div>
          <ul>
            {background.map((t) => (
              <li key={t.key}>
                <span className="dl-bg-title">
                  <strong>{t.title}</strong> <span className="muted">· {t.label}</span>
                </span>
                <span className={`dl-bg-state${t.phase === "failed" ? " err" : t.phase === "started" ? " ok" : ""}`}>
                  {ACTIVE.includes(t.phase) && <LoaderCircle className="spin" aria-hidden />}
                  {t.phase === "failed" ? t.message || "Failed" : phaseText(t)}
                  {t.phase === "requested" && t.href && (
                    <>
                      {" · "}
                      <a href={t.href} download onClick={keepToPage}>
                        Save it here
                      </a>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

    </div>
  );
}


/** Fallback "save" links: keep the click inside the app, away from page-level third-party listeners. */
const keepToPage = (e: { stopPropagation: () => void }) => e.stopPropagation();

// ── Result building blocks ─────────────────────────────────────────────────
type TransferFor = (result: ResultState, key: string) => Transfer | undefined;
type Choose = (result: ResultState, itemIndex: number, formatId: string, label: string) => void;

function TransferStatus({ t }: { t: Transfer }) {
  const active = ACTIVE.includes(t.phase);
  const pct = t.phase === "downloading" && t.progress ? Math.round(t.progress) : null;
  return (
    <>
      {active && (
        <span className="dl-progress" aria-hidden>
          <span className={pct == null ? "indeterminate" : ""} style={pct == null ? undefined : { width: `${pct}%` }} />
        </span>
      )}
      {t.phase === "requested" && t.href && (
        <span className="dl-note">
          Your browser was asked to save the file. Nothing in your downloads?{" "}
          <a href={t.href} download onClick={keepToPage}>
            Save it here
          </a>
          .
        </span>
      )}
      {t.phase === "started" && <span className="dl-note">Check your browser&apos;s downloads. The file is deleted from our server shortly.</span>}
    </>
  );
}

/** Download / progress / done button for one choice. */
function ActionButton({ t, label, onClick, compact }: { t?: Transfer; label: string; onClick: () => void; compact?: boolean }) {
  const active = !!t && ACTIVE.includes(t.phase);
  if (t && !active && t.phase !== "failed")
    return (
      <span className={`dl-done${t.phase === "started" ? " ok" : ""}`} role="status">
        <CircleCheck aria-hidden /> {phaseText(t)}
      </span>
    );
  return (
    <button type="button" className={`btn btn-sm${compact ? " btn-primary" : ""}`} disabled={active} onClick={onClick}
      aria-label={active ? `${label}: ${phaseText(t!)}` : t?.phase === "failed" ? `Retry ${label}` : `Download ${label}`}>
      {active ? <LoaderCircle className="spin" aria-hidden /> : t?.phase === "failed" ? <RotateCcw aria-hidden /> : <Download aria-hidden />}
      {active ? phaseText(t!) : t?.phase === "failed" ? "Retry" : "Download"}
    </button>
  );
}

/** Single video or audio: one row per real quality, grouped Video / Audio. */
function FormatList({ item, result, transferFor, choose, preferred }: { item: MediaItem; result: ResultState; transferFor: TransferFor; choose: Choose; preferred: string | null }) {
  const groups: Array<[string, MediaFormat[], React.ReactNode]> = [
    ["Video", item.formats.filter((f) => f.kind !== "audio"), <Video key="v" aria-hidden />],
    ["Audio", item.formats.filter((f) => f.kind === "audio"), <Music key="a" aria-hidden />],
  ];
  const showHeads = groups.every(([, fs]) => fs.length > 0);
  return (
    <div className="format-list">
      {groups.map(([name, fs, icon]) =>
        fs.length === 0 ? null : (
          <div key={name} className="format-group">
            {showHeads && (
              <div className="field-label format-group-head">
                {icon} {name}
              </div>
            )}
            {fs.map((f) => {
              const t = transferFor(result, `${item.index}:${f.id}`);
              return (
                <div key={f.id} className={`format-item${t?.phase === "failed" ? " is-failed" : ""}`}>
                  <span className="format-label">
                    <strong>{f.label}</strong>{" "}
                    <span className="muted">{[f.label.toUpperCase().includes(f.ext.toUpperCase()) ? "" : f.ext.toUpperCase(), formatSize(f.filesize)].filter(Boolean).join(" · ")}</span>
                    {preferred === f.id && !t && <span className="badge badge-neutral">Last used</span>}
                  </span>
                  <span className="format-action">
                    <ActionButton t={t} label={f.label} onClick={() => choose(result, item.index, f.id, f.label)} />
                  </span>
                  {t && <TransferStatus t={t} />}
                </div>
              );
            })}
          </div>
        ),
      )}
    </div>
  );
}

const KIND_ICON = { video: Video, image: ImageIcon, audio: Music } as const;

/** One item of a post (image, video or audio) with its own preview and controls. */
function MediaCard({ item, result, preview, transferFor, choose, selected, onSelect }: {
  item: MediaItem; result: ResultState; preview: (u?: string) => string | undefined; transferFor: TransferFor; choose: Choose;
  selected?: boolean; onSelect?: (on: boolean) => void;
}) {
  const [fmt, setFmt] = useState(item.formats[0]?.id ?? "");
  const [conv, setConv] = useState("");
  const [broken, setBroken] = useState(false);
  const f = item.formats.find((x) => x.id === fmt) ?? item.formats[0];
  if (!f) return null;
  const isImage = item.kind === "image";
  const conversions = isImage ? (item.conversions ?? []).filter((c) => c !== f.ext.replace("jpeg", "jpg")) : [];
  const formatId = conv ? `${f.id}~${conv}` : f.id;
  const t = transferFor(result, `${item.index}:${formatId}`);
  const Icon = KIND_ICON[item.kind] ?? Video;
  const label = `${isImage ? "image" : item.kind} ${item.index + 1}`;
  const src = preview(item.thumbnail);
  return (
    <div className={`media-card${selected ? " is-selected" : ""}`} data-kind={item.kind} data-index={item.index}>
      <div className="media-card-preview">
        {src && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={`${item.kind} ${item.index + 1} preview`} loading="lazy" onError={() => setBroken(true)} />
        ) : (
          <span className="media-card-placeholder"><Icon aria-hidden /></span>
        )}
        <span className="media-card-kind"><Icon aria-hidden /> {item.kind === "image" ? "Image" : item.kind === "audio" ? "Audio" : "Video"} {item.index + 1}</span>
        {onSelect && (
          <label className="media-card-check">
            <input type="checkbox" checked={!!selected} onChange={(e) => onSelect(e.target.checked)} aria-label={`Select ${label}`} />
          </label>
        )}
      </div>
      <div className="media-card-body">
        {item.formats.length > 1 ? (
          <select className="input input-sm" aria-label={`${isImage ? "Size" : "Quality"} for ${label}`} value={f.id} onChange={(e) => setFmt(e.target.value)}>
            {item.formats.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}{x.filesize ? ` · ${formatSize(x.filesize)}` : ""}
              </option>
            ))}
          </select>
        ) : (
          <span className="media-card-label">{f.label}{isImage && !/·\s*\d+×\d+/.test(f.label) && item.width ? ` · ${item.width}×${item.height}` : ""}</span>
        )}
        {conversions.length > 0 && (
          <select className="input input-sm" aria-label={`File format for ${label}`} value={conv} onChange={(e) => setConv(e.target.value)}>
            <option value="">{f.ext.toUpperCase()} (original file)</option>
            {conversions.map((c) => (
              <option key={c} value={c}>
                {c.toUpperCase()} (converted)
              </option>
            ))}
          </select>
        )}
        <ActionButton t={t} label={label} compact onClick={() => choose(result, item.index, formatId, `${label} · ${f.label}`)} />
        {t && <TransferStatus t={t} />}
      </div>
    </div>
  );
}

function ZipButton({ result, selected, transferFor, chooseZip }: { result: ResultState; selected: number[]; transferFor: TransferFor; chooseZip: (r: ResultState, items: number[]) => void }) {
  const items = [...selected].sort((a, b) => a - b);
  const t = items.length >= 2 ? transferFor(result, `zip:${items.join(",")}`) : undefined;
  const active = !!t && ACTIVE.includes(t.phase);
  if (t && !active && t.phase !== "failed")
    return (
      <span className="zip-status">
        <span className={`dl-done${t.phase === "started" ? " ok" : ""}`} role="status"><CircleCheck aria-hidden /> {phaseText(t)}</span>
        {t.phase === "requested" && t.href && <a href={t.href} download onClick={keepToPage}>Save ZIP</a>}
      </span>
    );
  return (
    <button type="button" className="btn btn-sm btn-primary" disabled={items.length < 2 || active} onClick={() => chooseZip(result, items)}>
      {active ? <LoaderCircle className="spin" aria-hidden /> : <FileArchive aria-hidden />}
      {active ? phaseText(t!) : `Download selected as ZIP${items.length ? ` (${items.length})` : ""}`}
    </button>
  );
}
