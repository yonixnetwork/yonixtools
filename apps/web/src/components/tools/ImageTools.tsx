"use client";
import { Download, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { downloadBlob, Field, Notice, NumberInput, Segmented } from "./ui";

type Mode = "compress" | "resize" | "convert";
type OutType = "image/jpeg" | "image/png" | "image/webp";

const EXT: Record<OutType, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_PIXELS = 50_000_000;

interface Source {
  file: File;
  bitmap: ImageBitmap | HTMLImageElement;
  width: number;
  height: number;
  url: string;
}

interface Result {
  blob: Blob;
  url: string;
  width: number;
  height: number;
  requested: OutType;
}

const fmtBytes = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)} MB` : `${(n / 1000).toFixed(1)} kB`);

async function decode(file: File): Promise<Source> {
  const url = URL.createObjectURL(file);
  try {
    if ("createImageBitmap" in window) {
      const bitmap = await createImageBitmap(file);
      return { file, bitmap, width: bitmap.width, height: bitmap.height, url };
    }
  } catch {
    /* fall back to <img> decoding below */
  }
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  await img.decode().catch(() => {
    throw new Error("This file couldn't be opened as an image in your browser.");
  });
  return { file, bitmap: img, width: img.naturalWidth, height: img.naturalHeight, url };
}

function encode(src: Source, w: number, h: number, type: OutType, quality: number | undefined, background: string): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser couldn't create a drawing canvas.");
  if (type === "image/jpeg") {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src.bitmap, 0, 0, w, h);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("The browser failed to encode the image."))), type, quality));
}

function defaultType(file: File, mode: Mode): OutType {
  if (mode === "convert") return file.type === "image/png" ? "image/jpeg" : "image/png";
  if (mode === "compress") return file.type === "image/webp" ? "image/webp" : "image/jpeg";
  return (["image/jpeg", "image/png", "image/webp"] as string[]).includes(file.type) ? (file.type as OutType) : "image/png";
}

export function ImageTool({ mode }: { mode: Mode }) {
  const [src, setSrc] = useState<Source | null>(null);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  const [type, setType] = useState<OutType>("image/jpeg");
  const [quality, setQuality] = useState(mode === "compress" ? 75 : 92);
  const [background, setBackground] = useState("#ffffff");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [lock, setLock] = useState(true);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async (file?: File | null) => {
    setError("");
    setResult(null);
    if (!file) return;
    if (!file.type.startsWith("image/") && !/\.(heic|heif|avif)$/i.test(file.name)) {
      setError("That file isn't an image. Choose a JPG, PNG, WebP, GIF or BMP file.");
      return;
    }
    try {
      const s = await decode(file);
      if (s.width * s.height > MAX_PIXELS) throw new Error(`This image is ${s.width}×${s.height} pixels, which is too large to process safely in a browser.`);
      if (src) URL.revokeObjectURL(src.url);
      setSrc(s);
      setType(defaultType(file, mode));
      setWidth(String(s.width));
      setHeight(String(s.height));
    } catch (e) {
      setError(/HEIC|heif/i.test(file.name) ? "Your browser can't open HEIC images. Try Safari, or convert on your phone first." : (e as Error).message || "This image couldn't be opened.");
    }
  };

  useEffect(() => {
    if (!src) return;
    const w = Math.round(Number(width));
    const h = Math.round(Number(height));
    if (!(w > 0 && h > 0) || w > 16384 || h > 16384) {
      setResult(null);
      return;
    }
    let alive = true;
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const blob = await encode(src, w, h, type, type === "image/png" ? undefined : quality / 100, background);
        if (!alive) return;
        setResult((prev) => {
          if (prev) URL.revokeObjectURL(prev.url);
          return { blob, url: URL.createObjectURL(blob), width: w, height: h, requested: type };
        });
        setError("");
      } catch (e) {
        if (alive) setError((e as Error).message);
      } finally {
        if (alive) setBusy(false);
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [src, width, height, type, quality, background]);

  const setW = (v: string) => {
    setWidth(v);
    if (lock && src && Number(v) > 0) setHeight(String(Math.max(1, Math.round((Number(v) * src.height) / src.width))));
  };
  const setH = (v: string) => {
    setHeight(v);
    if (lock && src && Number(v) > 0) setWidth(String(Math.max(1, Math.round((Number(v) * src.width) / src.height))));
  };
  const scale = (pct: number) => {
    if (!src) return;
    setWidth(String(Math.max(1, Math.round((src.width * pct) / 100))));
    setHeight(String(Math.max(1, Math.round((src.height * pct) / 100))));
  };

  const outName = src ? `${src.file.name.replace(/\.[^.]+$/, "")}-${mode === "compress" ? "compressed" : mode === "resize" ? `${result?.width}x${result?.height}` : "converted"}.${EXT[(result?.blob.type as OutType) || type] ?? "png"}` : "";
  const saving = src && result ? 1 - result.blob.size / src.file.size : 0;
  const encoderFallback = result && result.blob.type !== result.requested;

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div
        className={`dropzone${drag ? " drag" : ""}`}
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), inputRef.current?.click())}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          load(e.dataTransfer.files[0]);
        }}
      >
        <Upload aria-hidden />
        <strong>{src ? src.file.name : "Choose an image or drop it here"}</strong>
        <span className="muted" style={{ fontSize: "0.88rem" }}>
          {src ? `${src.width}×${src.height} · ${fmtBytes(src.file.size)} · click to change` : "JPG, PNG, WebP, GIF, BMP. Processed on your device, never uploaded."}
        </span>
        <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => load(e.target.files?.[0])} data-testid="image-input" />
      </div>

      {error && <Notice kind="error">{error}</Notice>}

      {src && (
        <>
          <div className="form-grid cols-2">
            <Field label="Output format">
              <Segmented
                label="Output format"
                value={type}
                onChange={setType}
                options={(mode === "compress" ? (["image/jpeg", "image/webp"] as OutType[]) : (["image/jpeg", "image/png", "image/webp"] as OutType[])).map((t) => ({ value: t, label: EXT[t].toUpperCase() }))}
              />
            </Field>
            {type !== "image/png" && (
              <Field label={`Quality: ${quality}%`} htmlFor="img-q" hint={mode === "compress" ? "70–85% is a good balance between size and quality." : undefined}>
                <input id="img-q" type="range" min={10} max={100} value={quality} onChange={(e) => setQuality(+e.target.value)} />
              </Field>
            )}
            {type === "image/jpeg" && (mode === "convert" || src.file.type === "image/png") && (
              <Field label="Background for transparent areas" htmlFor="img-bg">
                <input id="img-bg" type="color" value={background} onChange={(e) => setBackground(e.target.value)} />
              </Field>
            )}
          </div>

          {(mode === "resize" || mode === "compress") && (
            <div className="stack">
              <div className="form-grid cols-3" style={{ alignItems: "end" }}>
                <Field label="Width (px)" htmlFor="img-w">
                  <NumberInput id="img-w" value={width} onChange={setW} min={1} max={16384} step={1} />
                </Field>
                <Field label="Height (px)" htmlFor="img-h">
                  <NumberInput id="img-h" value={height} onChange={setH} min={1} max={16384} step={1} />
                </Field>
                <label className="check" style={{ height: 44 }}>
                  <input type="checkbox" checked={lock} onChange={(e) => setLock(e.target.checked)} /> Keep aspect ratio
                </label>
              </div>
              <div className="row" style={{ gap: 6 }}>
                {[25, 50, 75, 100].map((p) => (
                  <button key={p} type="button" className="chip" onClick={() => scale(p)}>
                    {p}%
                  </button>
                ))}
              </div>
            </div>
          )}

          {encoderFallback && <Notice kind="warn">Your browser can&apos;t encode {EXT[result!.requested].toUpperCase()}, so the output is {result!.blob.type.replace("image/", "").toUpperCase()}.</Notice>}

          <div className="stat-grid">
            <div className="stat">
              <div className="v">{fmtBytes(src.file.size)}</div>
              <div className="k">Original</div>
            </div>
            <div className="stat">
              <div className="v" data-testid="output-size">{result ? fmtBytes(result.blob.size) : busy ? "…" : "—"}</div>
              <div className="k">Result</div>
            </div>
            <div className="stat">
              <div className="v" style={{ color: saving > 0 ? "var(--success)" : undefined }}>{result ? `${saving >= 0 ? "−" : "+"}${Math.abs(saving * 100).toFixed(0)}%` : "—"}</div>
              <div className="k">Size change</div>
            </div>
            <div className="stat">
              <div className="v">{result ? `${result.width}×${result.height}` : "—"}</div>
              <div className="k">Dimensions</div>
            </div>
          </div>
          {result && saving < 0 && mode === "compress" && <Notice kind="info">The result is larger than the original, which was already well compressed. Lower the quality or the dimensions, or keep the original.</Notice>}

          {result && (
            <div className="row" style={{ justifyContent: "space-between" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={result.url} alt="Processed image preview" style={{ maxHeight: 220, width: "auto", borderRadius: 10, border: "1px solid var(--border)" }} />
              <button type="button" className="btn btn-primary" onClick={() => downloadBlob(result.blob, outName)}>
                <Download aria-hidden /> Download {EXT[(result.blob.type as OutType)] ? EXT[result.blob.type as OutType].toUpperCase() : ""}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export const ImageCompressor = () => <ImageTool mode="compress" />;
export const ImageResizer = () => <ImageTool mode="resize" />;
export const ImageConverter = () => <ImageTool mode="convert" />;
