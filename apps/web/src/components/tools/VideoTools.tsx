"use client";
import { Camera, Download, LoaderCircle, Music } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { FileDrop } from "./files";
import { downloadBlob, Field, Notice, Segmented } from "./ui";
import { aspectRatio, encodeWav, formatClock } from "@/lib/tools/media";
import { useFormat, useT } from "@/i18n/client";
import { isUserError, UserError } from "@/i18n/errors";

const ACCEPT = "video/*,.mp4,.webm,.mov,.m4v,.mkv";
const baseName = (f: File) => f.name.replace(/\.[^.]+$/, "") || "video";

/** Object URL for a file, revoked when it changes or the component unmounts. */
function useObjectUrl(file: File | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) return setUrl(null);
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url;
}

// ── Video info ───────────────────────────────────────────────────────────────
export function VideoInfo() {
  const t = useT("tools-video");
  const f = useFormat();
  const [file, setFile] = useState<File | null>(null);
  const url = useObjectUrl(file);
  const [meta, setMeta] = useState<{ duration: number; w: number; h: number } | null>(null);
  const [error, setError] = useState("");
  return (
    <div className="stack" style={{ gap: 16 }}>
      <FileDrop accept={ACCEPT} onFiles={(f) => { setMeta(null); setError(""); setFile(f[0] ?? null); }} label={t("chooseVideo")} hint={t("info.hint")} testId="vi-file" />
      {url && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video src={url} controls preload="metadata" className="video-preview"
          onLoadedMetadata={(e) => setMeta({ duration: e.currentTarget.duration, w: e.currentTarget.videoWidth, h: e.currentTarget.videoHeight })}
          onError={() => setError(t("info.unreadable"))} />
      )}
      {error && <Notice kind="error">{error}</Notice>}
      {file && meta && (
        <div className="kv" data-testid="vi-result">
          <div className="kv-row"><span className="muted">{t("info.file")}</span><code style={{ overflowWrap: "anywhere" }}>{file.name}</code></div>
          <div className="kv-row"><span className="muted">{t("info.size")}</span><code>{f.bytes(file.size)}</code></div>
          <div className="kv-row"><span className="muted">{t("info.type")}</span><code>{file.type || t("info.unknown")}</code></div>
          <div className="kv-row"><span className="muted">{t("info.duration")}</span><code data-testid="vi-duration">{Number.isFinite(meta.duration) ? formatClock(meta.duration, true) : t("info.unknown")}</code></div>
          <div className="kv-row"><span className="muted">{t("info.resolution")}</span><code data-testid="vi-res">{meta.w && meta.h ? `${meta.w} × ${meta.h} (${aspectRatio(meta.w, meta.h)})` : t("info.audioOnly")}</code></div>
          {Number.isFinite(meta.duration) && meta.duration > 0 && <div className="kv-row"><span className="muted">{t("info.bitrate")}</span><code>{t("info.kbps", { value: Math.round((file.size * 8) / meta.duration / 1000) })}</code></div>}
        </div>
      )}
    </div>
  );
}

// ── Frame extractor ──────────────────────────────────────────────────────────
export function VideoFrameExtractor() {
  const t = useT("tools-video");
  const [file, setFile] = useState<File | null>(null);
  const url = useObjectUrl(file);
  const video = useRef<HTMLVideoElement>(null);
  const [format, setFormat] = useState<"png" | "jpeg">("png");
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [error, setError] = useState("");
  const [shots, setShots] = useState(0);

  const capture = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return setError(t("frame.notReady"));
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    c.toBlob((b) => {
      if (!b) return setError(t("frame.captureFailed"));
      downloadBlob(b, `${file ? baseName(file) : "frame"}-${formatClock(v.currentTime, true).replace(/[:.]/g, "-")}.${format === "png" ? "png" : "jpg"}`);
      setShots((n) => n + 1);
    }, `image/${format}`, 0.92);
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <FileDrop accept={ACCEPT} onFiles={(f) => { setError(""); setShots(0); setFile(f[0] ?? null); }} label={t("chooseVideo")} hint={t("frame.hint")} testId="vf-file" />
      {url && (
        <>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={video} src={url} controls preload="auto" playsInline className="video-preview"
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)} onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
            onError={() => setError(t("frame.unplayable"))} />
          {duration > 0 && (
            <Field label={t("frame.position", { time: formatClock(time, true), duration: formatClock(duration, true) })} htmlFor="vf-pos">
              <input id="vf-pos" type="range" min={0} max={duration} step={0.04} value={time} onChange={(e) => { const pos = Number(e.target.value); setTime(pos); if (video.current) video.current.currentTime = pos; }} />
            </Field>
          )}
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <Segmented label={t("frame.format")} value={format} onChange={setFormat} options={[{ value: "png", label: t("frame.png") }, { value: "jpeg", label: t("frame.jpg") }]} />
            <button type="button" className="btn btn-primary" onClick={capture}>
              <Camera aria-hidden /> {t("frame.save")}
            </button>
          </div>
          {shots > 0 && <Notice kind="success">{t("frame.saved", { count: shots })}</Notice>}
        </>
      )}
      {error && <Notice kind="error">{error}</Notice>}
    </div>
  );
}

// ── Audio extractor ──────────────────────────────────────────────────────────
const MAX_BYTES = 500 * 1024 * 1024;

export function VideoAudioExtractor() {
  const t = useT("tools-video");
  const f = useFormat();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ blob: Blob; seconds: number; channels: number; rate: number } | null>(null);

  const extract = async () => {
    if (!file) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      if (file.size > MAX_BYTES) throw new UserError("audio.tooLarge");
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      try {
        const audio = await ctx.decodeAudioData(await file.arrayBuffer());
        if (audio.duration > 3 * 3600) throw new UserError("audio.tooLong");
        const chans = Array.from({ length: Math.min(2, audio.numberOfChannels) }, (_, i) => audio.getChannelData(i));
        const wav = encodeWav(chans, audio.sampleRate);
        setResult({ blob: new Blob([wav], { type: "audio/wav" }), seconds: audio.duration, channels: chans.length, rate: audio.sampleRate });
      } finally {
        void ctx.close();
      }
    } catch (e) {
      setError(isUserError(e) ? t(e.key, e.vars) : t("audio.noTrack"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <FileDrop accept={ACCEPT} onFiles={(f) => { setResult(null); setError(""); setFile(f[0] ?? null); }} label={t("chooseVideo")} hint={t("audio.hint")} testId="va-file" />
      {file && (
        <button type="button" className="btn btn-primary" onClick={extract} disabled={busy} style={{ alignSelf: "flex-start" }}>
          {busy ? <LoaderCircle className="spin" aria-hidden /> : <Music aria-hidden />} {busy ? t("audio.extracting") : t("audio.extract")}
        </button>
      )}
      {error && <Notice kind="error">{error}</Notice>}
      {result && file && (
        <div className="stack" style={{ gap: 10 }} data-testid="va-result">
          <Notice kind="success">
            {t(result.channels === 2 ? "audio.doneStereo" : "audio.doneMono", { duration: formatClock(result.seconds), rate: result.rate, size: f.bytes(result.blob.size) })}
          </Notice>
          <button type="button" className="btn" style={{ alignSelf: "flex-start" }} onClick={() => downloadBlob(result.blob, `${baseName(file)}.wav`)}>
            <Download aria-hidden /> {t("audio.download")}
          </button>
        </div>
      )}
    </div>
  );
}
