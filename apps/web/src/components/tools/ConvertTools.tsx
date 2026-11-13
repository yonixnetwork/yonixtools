"use client";
import { Clock, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CopyButton, Field, Notice, Segmented } from "./ui";
import { COMMON_ZONES, contrast, convertBase, formatColor, formatInZone, offsetLabel, parseColor, parseTimestamp, relativeTime, wallTimeToInstant, zoneOffsetMinutes } from "@/lib/tools/convert";

function Row({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="kv-row">
      <span className="muted">{label}</span>
      <code data-testid={testId} style={{ overflowWrap: "anywhere" }}>{value}</code>
      <CopyButton text={value} />
    </div>
  );
}

// ── Colour ───────────────────────────────────────────────────────────────────
export function ColorConverter() {
  const [input, setInput] = useState("#2563EB");
  const c = parseColor(input);
  const out = c ? formatColor(c) : null;
  const ratio = c ? contrast(c) : null;
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="form-grid cols-2" style={{ alignItems: "end" }}>
        <Field label="Colour (HEX, RGB or HSL)" htmlFor="cc-in" hint="Examples: #1e90ff, rgb(30 144 255), hsl(210, 100%, 56%)">
          <input id="cc-in" className="input mono" value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} autoComplete="off" />
        </Field>
        <Field label="Pick a colour" htmlFor="cc-pick">
          <input id="cc-pick" type="color" className="input" style={{ padding: 4, height: 46 }} value={out ? out.hex.slice(0, 7).toLowerCase() : "#000000"} onChange={(e) => setInput(e.target.value.toUpperCase())} />
        </Field>
      </div>
      {out && c && ratio ? (
        <>
          <div className="color-swatch" style={{ background: out.rgb }} aria-label={`Preview of ${out.hex}`} role="img" />
          <div className="kv">
            <Row label="HEX" value={out.hex} testId="cc-hex" />
            <Row label="RGB" value={out.rgb} testId="cc-rgb" />
            <Row label="HSL" value={out.hsl} testId="cc-hsl" />
          </div>
          <p className="muted" style={{ fontSize: "0.88rem" }}>
            Contrast with white text: <strong>{ratio.white}:1</strong> · with black text: <strong>{ratio.black}:1</strong>. WCAG AA needs 4.5:1 for normal text.
          </p>
        </>
      ) : (
        <Notice kind="info">Enter a colour such as #1E90FF, rgb(30, 144, 255) or hsl(210, 100%, 56%).</Notice>
      )}
    </div>
  );
}

// ── Unix timestamp ───────────────────────────────────────────────────────────
export function TimestampConverter() {
  const [input, setInput] = useState("");
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const parsed = parseTimestamp(input);
  const d = parsed?.date;
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="notice notice-info" role="status">
        <Clock aria-hidden />
        <div>
          Current Unix time: <strong className="mono" data-testid="ts-now">{now ? Math.floor(now / 1000) : "…"}</strong>
          {now && (
            <button type="button" className="btn btn-sm btn-ghost" style={{ marginLeft: 8 }} onClick={() => setInput(String(Math.floor(now / 1000)))}>
              Use it
            </button>
          )}
        </div>
      </div>
      <Field label="Timestamp or date" htmlFor="ts-in" hint="Seconds (10 digits), milliseconds (13 digits) or a date such as 2026-03-01 14:30 or 2026-03-01T14:30:00Z">
        <input id="ts-in" className="input mono" value={input} onChange={(e) => setInput(e.target.value)} placeholder="1700000000" spellCheck={false} autoComplete="off" />
      </Field>
      {input.trim() && !d && <Notice kind="error">That isn&apos;t a timestamp or a date we can read.</Notice>}
      {d && (
        <div className="kv">
          {parsed!.unit !== "date" && <p className="muted" style={{ margin: 0 }}>Read as {parsed!.unit}.</p>}
          <Row label="Unix (seconds)" value={String(Math.floor(d.getTime() / 1000))} testId="ts-seconds" />
          <Row label="Unix (milliseconds)" value={String(d.getTime())} />
          <Row label="ISO 8601 (UTC)" value={d.toISOString()} testId="ts-iso" />
          <Row label="UTC" value={d.toUTCString()} />
          <Row label="Your time zone" value={d.toLocaleString("en-GB", { dateStyle: "full", timeStyle: "long" })} />
          {now && <Row label="Relative" value={relativeTime(d, now)} />}
        </div>
      )}
    </div>
  );
}

// ── Number base ──────────────────────────────────────────────────────────────
const BASES = [
  { value: "2", label: "Binary (2)" },
  { value: "8", label: "Octal (8)" },
  { value: "10", label: "Decimal (10)" },
  { value: "16", label: "Hex (16)" },
] as const;

export function NumberBaseConverter() {
  const [value, setValue] = useState("255");
  const [from, setFrom] = useState<"2" | "8" | "10" | "16">("10");
  const results = useMemo(() => BASES.map((b) => ({ ...b, out: convertBase(value, Number(from), Number(b.value)) })), [value, from]);
  const [custom, setCustom] = useState("36");
  const customOut = convertBase(value, Number(from), Number(custom));
  const invalid = value.trim() !== "" && results[0].out === null;
  return (
    <div className="stack" style={{ gap: 16 }}>
      <Segmented label="Input base" value={from} onChange={setFrom} options={BASES.map((b) => ({ value: b.value, label: b.label }))} />
      <Field label="Number" htmlFor="nb-in" hint="Whole numbers of any size. Prefixes like 0x and 0b are accepted.">
        <input id="nb-in" className="input mono" value={value} onChange={(e) => setValue(e.target.value)} spellCheck={false} autoComplete="off" />
      </Field>
      {invalid && <Notice kind="error">That number contains digits that don&apos;t exist in base {from}.</Notice>}
      {!invalid && value.trim() && (
        <div className="kv">
          {results.map((r) => <Row key={r.value} label={r.label} value={r.out ?? "—"} testId={`nb-${r.value}`} />)}
          <div className="kv-row">
            <span className="muted">
              Base{" "}
              <input aria-label="Custom base" className="input" style={{ width: 70, height: 34, display: "inline-block" }} type="number" min={2} max={36} value={custom} onChange={(e) => setCustom(e.target.value)} />
            </span>
            <code>{customOut ?? "—"}</code>
            <CopyButton text={customOut ?? ""} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Time zones ───────────────────────────────────────────────────────────────
function zonesList(): string[] {
  try {
    const all = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone");
    if (all?.length) return Array.from(new Set(["UTC", ...all]));
  } catch {
    /* older browsers */
  }
  return COMMON_ZONES;
}

const localInputValue = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

export function TimeZoneConverter() {
  const [zones, setZones] = useState<string[]>(COMMON_ZONES);
  const [from, setFrom] = useState("UTC");
  const [when, setWhen] = useState("");
  const [targets, setTargets] = useState<string[]>(["America/New_York", "Europe/London", "Asia/Kolkata", "Asia/Tokyo"]);
  const [adding, setAdding] = useState("Australia/Sydney");
  useEffect(() => {
    setZones(zonesList());
    try {
      setFrom(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    } catch {
      /* keep UTC */
    }
    setWhen(localInputValue(new Date()));
  }, []);
  const instant = when ? wallTimeToInstant(when, from) : null;
  const options = zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>);
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="form-grid cols-2">
        <Field label="Date and time" htmlFor="tz-when">
          <input id="tz-when" className="input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </Field>
        <Field label="In time zone" htmlFor="tz-from">
          <select id="tz-from" className="input" value={from} onChange={(e) => setFrom(e.target.value)}>{options}</select>
        </Field>
      </div>
      {instant ? (
        <div className="kv" data-testid="tz-results">
          {targets.map((z) => (
            <div key={z} className="kv-row">
              <span className="muted">
                {z.replace(/_/g, " ")} <span style={{ fontSize: "0.8rem" }}>({offsetLabel(zoneOffsetMinutes(instant, z))})</span>
              </span>
              <code>{formatInZone(instant, z)}</code>
              <button type="button" className="btn btn-sm btn-ghost" aria-label={`Remove ${z}`} onClick={() => setTargets((t) => t.filter((x) => x !== z))}>
                <X aria-hidden />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <Notice kind="info">Choose a date and time.</Notice>
      )}
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <select aria-label="Time zone to add" className="input" style={{ maxWidth: 280 }} value={adding} onChange={(e) => setAdding(e.target.value)}>{options}</select>
        <button type="button" className="btn btn-sm" onClick={() => setTargets((t) => (t.includes(adding) ? t : [...t, adding]))}>
          <Plus aria-hidden /> Add time zone
        </button>
      </div>
    </div>
  );
}
