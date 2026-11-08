"use client";
import { Check, Copy, Download } from "lucide-react";
import { useState } from "react";

export function CopyButton({ text, label = "Copy", disabled }: { text: string; label?: string; disabled?: boolean }) {
  const [done, setDone] = useState<"ok" | "fail" | null>(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone("ok");
    } catch {
      setDone("fail");
    }
    setTimeout(() => setDone(null), 1600);
  };
  return (
    <button type="button" className="btn btn-sm" onClick={copy} disabled={disabled || !text} aria-live="polite">
      {done === "ok" ? <Check aria-hidden /> : <Copy aria-hidden />}
      {done === "ok" ? "Copied" : done === "fail" ? "Copy failed" : label}
    </button>
  );
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click(); // detached: page-level listeners (e.g. ad scripts) never see this click
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function DownloadTextButton({ text, filename, label = "Download", type = "text/plain" }: { text: string; filename: string; label?: string; type?: string }) {
  return (
    <button type="button" className="btn btn-sm" disabled={!text} onClick={() => downloadBlob(new Blob([text], { type }), filename)}>
      <Download aria-hidden /> {label}
    </button>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string }>; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Output({ label, text, filename, placeholder = "Output appears here", mono = true }: { label: string; text: string; filename?: string; placeholder?: string; mono?: boolean }) {
  return (
    <div className="output">
      <div className="output-head">
        <span className="field-label">{label}</span>
        <span className="row" style={{ gap: 6 }}>
          {filename && <DownloadTextButton text={text} filename={filename} />}
          <CopyButton text={text} />
        </span>
      </div>
      <pre aria-label={label} style={mono ? undefined : { fontFamily: "var(--font)", fontSize: "0.95rem" }}>
        {text || <span className="muted">{placeholder}</span>}
      </pre>
    </div>
  );
}

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

export function NumberInput({ id, value, onChange, min, max, step, suffix }: { id: string; value: string; onChange: (v: string) => void; min?: number; max?: number; step?: number | "any"; suffix?: string }) {
  return (
    <div style={{ position: "relative" }}>
      <input id={id} className="input" type="number" inputMode="decimal" value={value} min={min} max={max} step={step ?? "any"} onChange={(e) => onChange(e.target.value)} style={suffix ? { paddingRight: 48 } : undefined} />
      {suffix && (
        <span className="muted" style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: "0.88rem", pointerEvents: "none" }}>
          {suffix}
        </span>
      )}
    </div>
  );
}

export function Notice({ kind, children }: { kind: "error" | "info" | "success" | "warn"; children: React.ReactNode }) {
  return (
    <div className={`notice notice-${kind}`} role={kind === "error" ? "alert" : "status"}>
      <div>{children}</div>
    </div>
  );
}

export const num = (s: string) => (s.trim() === "" ? NaN : Number(s));

export function money(v: number, digits = 2) {
  return Number.isFinite(v) ? v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }) : "—";
}
