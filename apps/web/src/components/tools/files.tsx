"use client";
import { ArrowDown, ArrowUp, Trash2, Upload } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useFormat, useT } from "@/i18n/client";
import { formatNumber } from "@/i18n/format";
import { downloadBlob } from "./ui";

/** English-only file size (decimal kB/MB). Prefer useFileSize() in components. */
export const fmtBytes = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)} MB` : `${Math.max(0.1, n / 1000).toFixed(1)} kB`);

/** Locale-aware file size with the same decimal kB/MB rules as fmtBytes ("1.2 kB", "3.40 MB" in English). */
export function formatFileSize(locale: string, n: number): string {
  return n >= 1_000_000
    ? formatNumber(locale, n / 1_000_000, { style: "unit", unit: "megabyte", unitDisplay: "short", minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : formatNumber(locale, Math.max(0.1, n / 1000), { style: "unit", unit: "kilobyte", unitDisplay: "short", minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** Hook variant of formatFileSize for the current locale. */
export function useFileSize(): (n: number) => string {
  const { locale } = useFormat();
  return useCallback((n: number) => formatFileSize(locale, n), [locale]);
}

export function FileDrop({ accept, multiple, onFiles, label, hint, testId }: { accept: string; multiple?: boolean; onFiles: (files: File[]) => void; label?: string; hint?: string; testId?: string }) {
  const t = useT("tools-ui");
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
      <strong>{label ?? t(multiple ? "files.dropMany" : "files.dropOne")}</strong>
      <span className="muted" style={{ fontSize: "0.88rem" }}>{hint ?? t("processedOnDevice")}</span>
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

export function FileOrderList<T extends { id: string; name: string; size: number; note?: string }>({ items, onChange, label }: { items: T[]; onChange: (items: T[]) => void; label?: string }) {
  const t = useT("tools-ui");
  const size = useFileSize();
  const move = (i: number, d: number) => {
    const next = [...items];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <ol className="file-list" aria-label={label ?? t("files.listLabel")}>
      {items.map((f, i) => (
        <li key={f.id}>
          <span className="file-index">{i + 1}</span>
          <span className="file-name">
            {f.name}
            <span className="muted"> · {size(f.size)}{f.note ? ` · ${f.note}` : ""}</span>
          </span>
          <span className="row" style={{ gap: 2 }}>
            <button type="button" className="icon-button" aria-label={t("files.moveUp", { name: f.name })} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp aria-hidden /></button>
            <button type="button" className="icon-button" aria-label={t("files.moveDown", { name: f.name })} disabled={i === items.length - 1} onClick={() => move(i, 1)}><ArrowDown aria-hidden /></button>
            <button type="button" className="icon-button" aria-label={t("files.remove", { name: f.name })} onClick={() => onChange(items.filter((x) => x.id !== f.id))}><Trash2 aria-hidden /></button>
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
