"use client";
import { Camera, Download, LoaderCircle, Music } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { FileDrop } from "./files";
import { downloadBlob, Field, Notice, Segmented } from "./ui";
import { aspectRatio, encodeWav, formatBytes, formatClock } from "@/lib/tools/media";

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
  const [file, setFile] = useState<File | null>(null);
  const url = useObjectUrl(file);
  const [meta, setMeta] = useState<{ duration: number; w: number; h: number } | null>(null);
  const [error, setError] = useState("");
  return (
    <div className="stack" style={{ gap: 16 }}>
      <FileDrop accept={ACCEPT} onFiles={(f) => { setMeta(null); setError(""); setFile(f[0] ?? null); }} label="Choose a video" hint="MP4, WebM, MOV… Read on your device, never uploaded." testId="vi-file" />
      {url && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video src={url} controls preload="metadata" className="video-preview"
          onLoadedMetadata={(e) => setMeta({ duration: e.currentTarget.duration, w: e.currentTarget.videoWidth, h: e.currentTarget.videoHeight })}
          onError={() => setError("Your browser can't read this video format. Try MP4 (H.264) or WebM.")} />
      )}
      {error && <Notice kind="error">{error}</Notice>}
      {file && meta && (
        <div className="kv" data-testid="vi-result">
          <div className="kv-row"><span className="muted">File</span><code style={{ overflowWrap: "anywhere" }}>{file.name}</code></div>
          <div className="kv-row"><span className="muted">Size</span><code>{formatBytes(file.size)}</code></div>
          <div className="kv-row"><span className="muted">Type</span><code>{file.type || "unknown"}</code></div>
          <div className="kv-row"><span className="muted">Duration</span><code data-testid="vi-duration">{Number.isFinite(meta.duration) ? formatClock(meta.duration, true) : "unknown"}</code></div>
          <div className="kv-row"><span className="muted">Resolution</span><code data-testid="vi-res">{meta.w && meta.h ? `${meta.w} × ${meta.h} (${aspectRatio(meta.w, meta.h)})` : "audio only"}</code></div>
          {Number.isFinite(meta.duration) && meta.duration > 0 && <div className="kv-row"><span className="muted">Average bitrate</span><code>{Math.round((file.size * 8) / meta.duration / 1000).toLocaleString("en-US")} kbps</code></div>}
        </div>
      )}
    </div>
  );
}

// ── Frame extractor ──────────────────────────────────────────────────────────
export function VideoFrameExtractor() {
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
    if (!v || !v.videoWidth) return setError("Wait for the video to load, then try again.");
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    c.toBlob((b) => {
      if (!b) return setError("Couldn't capture this frame.");
      downloadBlob(b, `${file ? baseName(file) : "frame"}-${formatClock(v.currentTime, true).replace(/[:.]/g, "-")}.${format === "png" ? "png" : "jpg"}`);
      setShots((n) => n + 1);
    }, `image/${format}`, 0.92);
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <FileDrop accept={ACCEPT} onFiles={(f) => { setError(""); setShots(0); setFile(f[0] ?? null); }} label="Choose a video" hint="The frame is captured at full resolution on your device." testId="vf-file" />
      {url && (
        <>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={video} src={url} controls preload="auto" playsInline className="video-preview"
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)} onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
            onError={() => setError("Your browser can't play this video format. Try MP4 (H.264) or WebM.")} />
          {duration > 0 && (
            <Field label={`Position: ${formatClock(time, true)} of ${formatClock(duration, true)}`} htmlFor="vf-pos">
              <input id="vf-pos" type="range" min={0} max={duration} step={0.04} value={time} onChange={(e) => { const t = Number(e.target.value); setTime(t); if (video.current) video.current.currentTime = t; }} />
            </Field>
          )}
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <Segmented label="Image format" value={format} onChange={setFormat} options={[{ value: "png", label: "PNG (lossless)" }, { value: "jpeg", label: "JPG (smaller)" }]} />
            <button type="button" className="btn btn-primary" onClick={capture}>
              <Camera aria-hidden /> Save this frame
            </button>
          </div>
          {shots > 0 && <Notice kind="success">{shots} frame{shots > 1 ? "s" : ""} saved to your downloads.</Notice>}
        </>
      )}
      {error && <Notice kind="error">{error}</Notice>}
    </div>
  );
}

// ── Audio extractor ──────────────────────────────────────────────────────────
const MAX_BYTES = 500 * 1024 * 1024;

export function VideoAudioExtractor() {
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
      if (file.size > MAX_BYTES) throw new Error("This file is larger than 500 MB, which is too much to decode in a browser tab.");
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      try {
        const audio = await ctx.decodeAudioData(await file.arrayBuffer());
        if (audio.duration > 3 * 3600) throw new Error("The audio is longer than 3 hours.");
        const chans = Array.from({ length: Math.min(2, audio.numberOfChannels) }, (_, i) => audio.getChannelData(i));
        const wav = encodeWav(chans, audio.sampleRate);
        setResult({ blob: new Blob([wav], { type: "audio/wav" }), seconds: audio.duration, channels: chans.length, rate: audio.sampleRate });
      } finally {
        void ctx.close();
      }
    } catch (e) {
      setError(e instanceof Error && e.message && !/decode|EncodingError/i.test(e.name + e.message) ? e.message : "This video has no audio track your browser can decode. Try an MP4 (AAC audio) or WebM file.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <FileDrop accept={ACCEPT} onFiles={(f) => { setResult(null); setError(""); setFile(f[0] ?? null); }} label="Choose a video" hint="The audio is decoded on your device and saved as WAV." testId="va-file" />
      {file && (
        <button type="button" className="btn btn-primary" onClick={extract} disabled={busy} style={{ alignSelf: "flex-start" }}>
          {busy ? <LoaderCircle className="spin" aria-hidden /> : <Music aria-hidden />} {busy ? "Extracting…" : "Extract audio"}
        </button>
      )}
      {error && <Notice kind="error">{error}</Notice>}
      {result && file && (
        <div className="stack" style={{ gap: 10 }} data-testid="va-result">
          <Notice kind="success">
            Audio extracted: {formatClock(result.seconds)} · {result.channels === 2 ? "stereo" : "mono"} · {result.rate.toLocaleString("en-US")} Hz · {formatBytes(result.blob.size)} WAV
          </Notice>
          <button type="button" className="btn" style={{ alignSelf: "flex-start" }} onClick={() => downloadBlob(result.blob, `${baseName(file)}.wav`)}>
            <Download aria-hidden /> Download WAV
          </button>
        </div>
      )}
    </div>
  );
}
