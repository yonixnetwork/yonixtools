"use client";
import { Clock, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CopyButton, Field, Notice, Segmented } from "./ui";
import { COMMON_ZONES, contrast, convertBase, displayDateLocale, formatColor, formatInZone, offsetLabel, parseColor, parseTimestamp, relativeTime, wallTimeToInstant, zoneOffsetMinutes } from "@/lib/tools/convert";
import { useFormat, useT } from "@/i18n/client";
import { formatDate } from "@/i18n/format";

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
  const t = useT("tools-convert");
  const [input, setInput] = useState("#2563EB");
  const c = parseColor(input);
  const out = c ? formatColor(c) : null;
  const ratio = c ? contrast(c) : null;
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="form-grid cols-2" style={{ alignItems: "end" }}>
        <Field label={t("color.input")} htmlFor="cc-in" hint={t("color.inputHint")}>
          <input id="cc-in" className="input mono" value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} autoComplete="off" />
        </Field>
        <Field label={t("color.pick")} htmlFor="cc-pick">
          <input id="cc-pick" type="color" className="input" style={{ padding: 4, height: 46 }} value={out ? out.hex.slice(0, 7).toLowerCase() : "#000000"} onChange={(e) => setInput(e.target.value.toUpperCase())} />
        </Field>
      </div>
      {out && c && ratio ? (
        <>
          <div className="color-swatch" style={{ background: out.rgb }} aria-label={t("color.previewAria", { hex: out.hex })} role="img" />
          <div className="kv">
            <Row label="HEX" value={out.hex} testId="cc-hex" />
            <Row label="RGB" value={out.rgb} testId="cc-rgb" />
            <Row label="HSL" value={out.hsl} testId="cc-hsl" />
          </div>
          <p className="muted" style={{ fontSize: "0.88rem" }}>
            {t.rich("color.contrast", { b: (c) => <strong>{c}</strong> }, { white: ratio.white, black: ratio.black })}
          </p>
        </>
      ) : (
        <Notice kind="info">{t("color.empty")}</Notice>
      )}
    </div>
  );
}

// ── Unix timestamp ───────────────────────────────────────────────────────────
export function TimestampConverter() {
  const t = useT("tools-convert");
  const f = useFormat();
  const [input, setInput] = useState("");
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const parsed = parseTimestamp(input);
  const d = parsed?.date;
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="notice notice-info" role="status">
        <Clock aria-hidden />
        <div>
          {t.rich("timestamp.current", { b: (c) => <strong className="mono" data-testid="ts-now">{c}</strong> }, { now: now ? String(Math.floor(now / 1000)) : "…" })}
          {now && (
            <button type="button" className="btn btn-sm btn-ghost" style={{ marginLeft: 8 }} onClick={() => setInput(String(Math.floor(now / 1000)))}>
              {t("timestamp.useIt")}
            </button>
          )}
        </div>
      </div>
      <Field label={t("timestamp.input")} htmlFor="ts-in" hint={t("timestamp.inputHint")}>
        <input id="ts-in" className="input mono" value={input} onChange={(e) => setInput(e.target.value)} placeholder="1700000000" spellCheck={false} autoComplete="off" />
      </Field>
      {input.trim() && !d && <Notice kind="error">{t("timestamp.invalid")}</Notice>}
      {d && (
        <div className="kv">
          {parsed!.unit !== "date" && <p className="muted" style={{ margin: 0 }}>{t(parsed!.unit === "seconds" ? "timestamp.readAsSeconds" : "timestamp.readAsMilliseconds")}</p>}
          <Row label={t("timestamp.unixSeconds")} value={String(Math.floor(d.getTime() / 1000))} testId="ts-seconds" />
          <Row label={t("timestamp.unixMilliseconds")} value={String(d.getTime())} />
          <Row label={t("timestamp.iso")} value={d.toISOString()} testId="ts-iso" />
          <Row label="UTC" value={d.toUTCString()} />
          <Row label={t("timestamp.yourZone")} value={formatDate(displayDateLocale(f.locale), d, { dateStyle: "full", timeStyle: "long" })} />
          {now && <Row label={t("timestamp.relative")} value={relativeTime(d, now, f.locale)} />}
        </div>
      )}
    </div>
  );
}

// ── Number base ──────────────────────────────────────────────────────────────
const BASES = [
  { value: "2", label: "base.binary" },
  { value: "8", label: "base.octal" },
  { value: "10", label: "base.decimal" },
  { value: "16", label: "base.hex" },
] as const; // label = translation key

export function NumberBaseConverter() {
  const t = useT("tools-convert");
  const [value, setValue] = useState("255");
  const [from, setFrom] = useState<"2" | "8" | "10" | "16">("10");
  const results = useMemo(() => BASES.map((b) => ({ ...b, out: convertBase(value, Number(from), Number(b.value)) })), [value, from]);
  const [custom, setCustom] = useState("36");
  const customOut = convertBase(value, Number(from), Number(custom));
  const invalid = value.trim() !== "" && results[0].out === null;
  return (
    <div className="stack" style={{ gap: 16 }}>
      <Segmented label={t("base.inputBase")} value={from} onChange={setFrom} options={BASES.map((b) => ({ value: b.value, label: t(b.label) }))} />
      <Field label={t("base.number")} htmlFor="nb-in" hint={t("base.numberHint")}>
        <input id="nb-in" className="input mono" value={value} onChange={(e) => setValue(e.target.value)} spellCheck={false} autoComplete="off" />
      </Field>
      {invalid && <Notice kind="error">{t("base.invalid", { base: from })}</Notice>}
      {!invalid && value.trim() && (
        <div className="kv">
          {results.map((r) => <Row key={r.value} label={t(r.label)} value={r.out ?? "—"} testId={`nb-${r.value}`} />)}
          <div className="kv-row">
            <span className="muted">
              {t("base.custom")}{" "}
              <input aria-label={t("base.customAria")} className="input" style={{ width: 70, height: 34, display: "inline-block" }} type="number" min={2} max={36} value={custom} onChange={(e) => setCustom(e.target.value)} />
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
  const t = useT("tools-convert");
  const f = useFormat();
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
        <Field label={t("zone.when")} htmlFor="tz-when">
          <input id="tz-when" className="input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </Field>
        <Field label={t("zone.from")} htmlFor="tz-from">
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
              <code>{formatInZone(instant, z, f.locale)}</code>
              <button type="button" className="btn btn-sm btn-ghost" aria-label={t("zone.removeAria", { zone: z })} onClick={() => setTargets((ts) => ts.filter((x) => x !== z))}>
                <X aria-hidden />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <Notice kind="info">{t("zone.empty")}</Notice>
      )}
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <select aria-label={t("zone.addAria")} className="input" style={{ maxWidth: 280 }} value={adding} onChange={(e) => setAdding(e.target.value)}>{options}</select>
        <button type="button" className="btn btn-sm" onClick={() => setTargets((ts) => (ts.includes(adding) ? ts : [...ts, adding]))}>
          <Plus aria-hidden /> {t("zone.add")}
        </button>
      </div>
    </div>
  );
}
