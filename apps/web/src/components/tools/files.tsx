"use client";
import { ArrowDown, ArrowUp, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { downloadBlob } from "./ui";

export const fmtBytes = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)} MB` : `${Math.max(0.1, n / 1000).toFixed(1)} kB`);

export function FileDrop({ accept, multiple, onFiles, label, hint, testId }: { accept: string; multiple?: boolean; onFiles: (files: File[]) => void; label: string; hint: string; testId?: string }) {
  const [drag, setDrag] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div
      className={`dropzone${drag ? " drag" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => ref.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), ref.current?.click())}
      onDragOver={(e) => (e.preventDefault(), setDrag(true))}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length) onFiles(multiple ? files : files.slice(0, 1));
      }}
    >
      <Upload aria-hidden />
      <strong>{label}</strong>
      <span className="muted" style={{ fontSize: "0.88rem" }}>{hint}</span>
      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        data-testid={testId}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function FileOrderList<T extends { id: string; name: string; size: number; note?: string }>({ items, onChange }: { items: T[]; onChange: (items: T[]) => void }) {
  const move = (i: number, d: number) => {
    const next = [...items];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <ol className="file-list" aria-label="Files">
      {items.map((f, i) => (
        <li key={f.id}>
          <span className="file-index">{i + 1}</span>
          <span className="file-name">
            {f.name}
            <span className="muted"> · {fmtBytes(f.size)}{f.note ? ` · ${f.note}` : ""}</span>
          </span>
          <span className="row" style={{ gap: 2 }}>
            <button type="button" className="icon-button" aria-label={`Move ${f.name} up`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp aria-hidden /></button>
            <button type="button" className="icon-button" aria-label={`Move ${f.name} down`} disabled={i === items.length - 1} onClick={() => move(i, 1)}><ArrowDown aria-hidden /></button>
            <button type="button" className="icon-button" aria-label={`Remove ${f.name}`} onClick={() => onChange(items.filter((x) => x.id !== f.id))}><Trash2 aria-hidden /></button>
          </span>
        </li>
      ))}
    </ol>
  );
}

export async function downloadZip(files: Array<{ name: string; bytes: Uint8Array }>, zipName: string) {
  const { zipSync } = await import("fflate");
  const data = zipSync(Object.fromEntries(files.map((f) => [f.name, [f.bytes, { level: 0 }]])));
  downloadBlob(new Blob([data as BlobPart], { type: "application/zip" }), zipName);
}

export const toBlob = (bytes: Uint8Array, type: string) => new Blob([bytes as BlobPart], { type });
export const baseName = (name: string) => name.replace(/\.[^.]+$/, "");
export const uid = () => Math.random().toString(36).slice(2, 10);
