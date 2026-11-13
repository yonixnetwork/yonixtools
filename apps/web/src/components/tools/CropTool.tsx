"use client";
import { Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { baseName, FileDrop } from "./files";
import { downloadBlob, Field, Notice, NumberInput, Segmented } from "./ui";
import { centeredAspect, clampRect, resizeFromCorner, type Rect } from "@/lib/tools/crop";

const RATIOS = [
  { value: "free", label: "Free", r: null },
  { value: "1:1", label: "1:1", r: 1 },
  { value: "4:5", label: "4:5", r: 4 / 5 },
  { value: "4:3", label: "4:3", r: 4 / 3 },
  { value: "3:2", label: "3:2", r: 3 / 2 },
  { value: "16:9", label: "16:9", r: 16 / 9 },
] as const;
type RatioKey = (typeof RATIOS)[number]["value"];

export function ImageCropper() {
  const [src, setSrc] = useState<{ url: string; file: File; w: number; h: number } | null>(null);
  const [rect, setRect] = useState<Rect>({ x: 0, y: 0, w: 0, h: 0 });
  const [ratio, setRatio] = useState<RatioKey>("free");
  const [error, setError] = useState("");
  const imgRef = useRef<HTMLImageElement>(null);
  const drag = useRef<{ kind: "move" | "nw" | "ne" | "sw" | "se"; startX: number; startY: number; start: Rect; scale: number } | null>(null);
  const aspect = RATIOS.find((r) => r.value === ratio)!.r;

  useEffect(() => () => {
    if (src) URL.revokeObjectURL(src.url);
  }, [src]);

  const load = (files: File[]) => {
    const f = files[0];
    setError("");
    if (!f.type.startsWith("image/")) return setError("That file isn't an image.");
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      setSrc({ url, file: f, w: img.naturalWidth, h: img.naturalHeight });
      setRect(centeredAspect(img.naturalWidth, img.naturalHeight, aspect));
    };
    img.onerror = () => setError("This image couldn't be opened in your browser.");
    img.src = url;
  };

  const chooseRatio = (r: RatioKey) => {
    setRatio(r);
    if (src) setRect(centeredAspect(src.w, src.h, RATIOS.find((x) => x.value === r)!.r));
  };

  const onDown = (kind: "move" | "nw" | "ne" | "sw" | "se") => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const img = imgRef.current!;
    drag.current = { kind, startX: e.clientX, startY: e.clientY, start: rect, scale: src!.w / img.getBoundingClientRect().width };
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !src) return;
    const dx = (e.clientX - d.startX) * d.scale;
    const dy = (e.clientY - d.startY) * d.scale;
    setRect(d.kind === "move" ? clampRect({ ...d.start, x: d.start.x + dx, y: d.start.y + dy }, src.w, src.h) : resizeFromCorner(d.start, dx, dy, d.kind, aspect, src.w, src.h));
  };
  const onUp = () => (drag.current = null);

  const setField = (k: keyof Rect) => (v: string) => {
    if (!src) return;
    const n = Number(v) || 0;
    let next = { ...rect, [k]: n };
    if (aspect && (k === "w" || k === "h")) next = k === "w" ? { ...next, h: n / aspect } : { ...next, w: n * aspect };
    setRect(clampRect(next, src.w, src.h));
  };

  const exportCrop = async () => {
    if (!src || !imgRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = rect.w;
    canvas.height = rect.h;
    canvas.getContext("2d")!.drawImage(imgRef.current, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
    const type = src.file.type === "image/jpeg" ? "image/jpeg" : "image/png";
    canvas.toBlob((b) => b && downloadBlob(b, `${baseName(src.file.name)}-${rect.w}x${rect.h}.${type === "image/jpeg" ? "jpg" : "png"}`), type, 0.95);
  };

  const pct = (v: number, total: number) => `${(v / total) * 100}%`;
  return (
    <div className="stack" style={{ gap: 16 }}>
      <FileDrop accept="image/*" onFiles={load} label={src ? src.file.name : "Choose an image or drop it here"} hint={src ? `${src.w}×${src.h} · click to change` : "Cropped on your device, never uploaded"} testId="image-input" />
      {error && <Notice kind="error">{error}</Notice>}
      {src && (
        <>
          <Segmented label="Aspect ratio" value={ratio} onChange={chooseRatio} options={RATIOS.map((r) => ({ value: r.value, label: r.label }))} />
          <div style={{ textAlign: "center" }}>
            <div className="crop-stage" onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img ref={imgRef} src={src.url} alt="Image being cropped" draggable={false} />
              <div className="crop-box" data-testid="crop-box" style={{ left: pct(rect.x, src.w), top: pct(rect.y, src.h), width: pct(rect.w, src.w), height: pct(rect.h, src.h) }} onPointerDown={onDown("move")}>
                {(["nw", "ne", "sw", "se"] as const).map((c) => <span key={c} className={`crop-handle ${c}`} onPointerDown={onDown(c)} />)}
              </div>
            </div>
          </div>
          <div className="form-grid cols-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))" }}>
            {(["x", "y", "w", "h"] as const).map((k) => (
              <Field key={k} label={{ x: "Left (px)", y: "Top (px)", w: "Width (px)", h: "Height (px)" }[k]} htmlFor={`crop-${k}`}>
                <NumberInput id={`crop-${k}`} value={String(rect[k])} onChange={setField(k)} min={0} step={1} />
              </Field>
            ))}
          </div>
          <div className="row">
            <button type="button" className="btn btn-primary" onClick={exportCrop}><Download aria-hidden /> Download {rect.w}×{rect.h}</button>
          </div>
        </>
      )}
    </div>
  );
}
