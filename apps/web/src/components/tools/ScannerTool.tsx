"use client";
import { Camera, ExternalLink, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CopyButton, Notice, Segmented } from "./ui";

type JsQR = typeof import("jsqr").default;
let jsqrPromise: Promise<JsQR> | null = null;
const loadJsQR = () => (jsqrPromise ??= import("jsqr").then((m) => m.default));

function describe(text: string): { kind: string; detail?: string; url?: string } {
  if (/^https?:\/\//i.test(text)) {
    try {
      return { kind: "Link", url: new URL(text).toString(), detail: new URL(text).hostname };
    } catch {
      /* fall through */
    }
  }
  if (/^WIFI:/i.test(text)) {
    const ssid = /S:((?:\\.|[^;])*)/.exec(text)?.[1]?.replace(/\\(.)/g, "$1");
    const type = /T:([^;]*)/.exec(text)?.[1];
    return { kind: "Wi-Fi network", detail: `${ssid ?? "?"}${type ? ` (${type})` : ""}` };
  }
  if (/^BEGIN:VCARD/i.test(text)) return { kind: "Contact card", detail: /FN:(.*)/.exec(text)?.[1]?.trim() };
  if (/^mailto:/i.test(text)) return { kind: "Email address", detail: text.slice(7) };
  if (/^tel:/i.test(text)) return { kind: "Phone number", detail: text.slice(4) };
  return { kind: "Text" };
}

function decodeCanvas(jsQR: JsQR, canvas: HTMLCanvasElement): string | null {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return jsQR(data.data, data.width, data.height, { inversionAttempts: "attemptBoth" })?.data ?? null;
}

export function QrScanner() {
  const [mode, setMode] = useState<"image" | "camera">("image");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  };
  useEffect(() => stop, []);
  useEffect(() => {
    if (mode !== "camera") stop();
  }, [mode]);

  const fromFile = async (file?: File) => {
    setError("");
    setResult(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Choose an image file (PNG, JPG, screenshot…).");
    try {
      const [jsQR, bitmap] = await Promise.all([loadJsQR(), createImageBitmap(file)]);
      // Try the original size, then downscaled copies (helps with very large photos).
      for (const max of [Infinity, 1600, 900]) {
        const s = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
        const c = document.createElement("canvas");
        c.width = Math.round(bitmap.width * s);
        c.height = Math.round(bitmap.height * s);
        c.getContext("2d")!.drawImage(bitmap, 0, 0, c.width, c.height);
        const text = decodeCanvas(jsQR, c);
        if (text !== null) return setResult(text);
      }
      setError("No QR code was found in this image. Try a sharper, closer or better-lit picture.");
    } catch {
      setError("This image couldn't be opened.");
    }
  };

  const startCamera = async () => {
    setError("");
    setResult(null);
    if (!navigator.mediaDevices?.getUserMedia) return setError("Your browser doesn't support camera access here. Upload an image instead.");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setScanning(true);
      const jsQR = await loadJsQR();
      const canvas = document.createElement("canvas");
      const tick = () => {
        if (!streamRef.current) return;
        if (video.readyState >= 2 && video.videoWidth) {
          const s = Math.min(1, 800 / video.videoWidth);
          canvas.width = Math.round(video.videoWidth * s);
          canvas.height = Math.round(video.videoHeight * s);
          canvas.getContext("2d", { willReadFrequently: true })!.drawImage(video, 0, 0, canvas.width, canvas.height);
          const text = decodeCanvas(jsQR, canvas);
          if (text !== null) {
            setResult(text);
            stop();
            return;
          }
        }
        setTimeout(() => requestAnimationFrame(tick), 150);
      };
      tick();
    } catch (e) {
      stop();
      const name = (e as { name?: string }).name;
      setError(name === "NotAllowedError" ? "Camera permission was denied. Allow camera access in your browser settings, or upload an image." : name === "NotFoundError" ? "No camera was found. Upload an image instead." : "The camera couldn't be started. Upload an image instead.");
    }
  };

  const info = result !== null ? describe(result) : null;
  return (
    <div className="stack" style={{ gap: 16 }}>
      <Segmented label="Source" value={mode} onChange={(m) => (setMode(m), setResult(null), setError(""))} options={[{ value: "image", label: "Upload image" }, { value: "camera", label: "Use camera" }]} />
      {mode === "image" ? (
        <label className="dropzone">
          <Upload aria-hidden />
          <strong>Choose an image with a QR code</strong>
          <span className="muted" style={{ fontSize: "0.88rem" }}>Screenshots and photos work. Decoded on your device.</span>
          <input ref={inputRef} type="file" accept="image/*" hidden data-testid="qr-input" onChange={(e) => fromFile(e.target.files?.[0])} />
        </label>
      ) : (
        <div className="stack">
          <video ref={videoRef} className="scanner-video" muted playsInline style={{ display: scanning ? "block" : "none" }} aria-label="Camera preview" />
          <div className="row">
            {!scanning ? (
              <button type="button" className="btn btn-primary" onClick={startCamera}><Camera aria-hidden /> Start camera</button>
            ) : (
              <button type="button" className="btn" onClick={stop}>Stop camera</button>
            )}
            {scanning && <span className="muted">Point the camera at a QR code…</span>}
          </div>
        </div>
      )}
      {error && <Notice kind="error">{error}</Notice>}
      {info && result !== null && (
        <div className="card card-pad stack" style={{ boxShadow: "none" }} aria-live="polite">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong>{info.kind}{info.detail ? `: ${info.detail}` : ""}</strong>
            <CopyButton text={result} />
          </div>
          <pre className="mono" style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all", fontSize: "0.9rem" }} data-testid="qr-result">{result}</pre>
          {info.url && (
            <div>
              <a className="btn btn-sm" href={info.url} target="_blank" rel="noopener noreferrer nofollow"><ExternalLink aria-hidden /> Open link</a>
              <p className="muted" style={{ fontSize: "0.82rem", marginTop: 6 }}>Check the address before opening links from QR codes you don&apos;t trust.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
