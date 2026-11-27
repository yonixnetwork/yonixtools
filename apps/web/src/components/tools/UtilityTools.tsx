"use client";
import { Dices, Flag, Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CopyButton, Field, Notice, NumberInput, num, Segmented } from "./ui";
import { formatClock, randomIntegers } from "@/lib/tools/media";
import { useT } from "@/i18n/client";
import type { Vars } from "@/i18n/format";

/** Same checks as randomIntegers (lib/tools/media), returned as a translation key for the message. */
function randomInputError(min: number, max: number, count: number, unique: boolean): { key: string; vars?: Vars } | null {
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max) return { key: "random.errorRange" };
  const span = max - min + 1;
  if (span > 2 ** 32) return { key: "random.errorTooLarge", vars: { max: 2 ** 32 } };
  if (!Number.isInteger(count) || count < 1 || count > 10000) return { key: "random.errorCount", vars: { min: 1, max: 10000 } };
  if (unique && count > span) return { key: "random.errorUnique", vars: { count: span } };
  return null;
}

// ── Random numbers ───────────────────────────────────────────────────────────
export function RandomNumberGenerator() {
  const t = useT("tools-util");
  const [min, setMin] = useState("1");
  const [max, setMax] = useState("100");
  const [count, setCount] = useState("1");
  const [unique, setUnique] = useState(true);
  const [sorted, setSorted] = useState(false);
  const [out, setOut] = useState<number[]>([]);
  const [error, setError] = useState("");
  const roll = () => {
    const invalid = randomInputError(num(min), num(max), num(count), unique);
    if (invalid) {
      setOut([]);
      setError(t(invalid.key, invalid.vars));
      return;
    }
    try {
      const xs = randomIntegers(num(min), num(max), num(count), unique);
      setOut(sorted ? [...xs].sort((a, b) => a - b) : xs);
      setError("");
    } catch (e) {
      setOut([]);
      setError(t("random.errorGeneric"));
    }
  };
  const text = out.join(", ");
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="form-grid cols-3">
        <Field label={t("random.min")} htmlFor="rn-min"><NumberInput id="rn-min" value={min} onChange={setMin} step={1} /></Field>
        <Field label={t("random.max")} htmlFor="rn-max"><NumberInput id="rn-max" value={max} onChange={setMax} step={1} /></Field>
        <Field label={t("random.count")} htmlFor="rn-count"><NumberInput id="rn-count" value={count} onChange={setCount} min={1} max={10000} step={1} /></Field>
      </div>
      <div className="row" style={{ gap: 16, flexWrap: "wrap" }}>
        <label className="check"><input type="checkbox" checked={unique} onChange={(e) => setUnique(e.target.checked)} /> {t("random.unique")}</label>
        <label className="check"><input type="checkbox" checked={sorted} onChange={(e) => setSorted(e.target.checked)} /> {t("random.sorted")}</label>
      </div>
      <button type="button" className="btn btn-primary" onClick={roll} style={{ alignSelf: "flex-start" }}>
        <Dices aria-hidden /> {t("random.generate")}
      </button>
      {error && <Notice kind="error">{error}</Notice>}
      {out.length > 0 && (
        <div className="output">
          <div className="output-head">
            <span className="field-label">{t("random.result", { count: out.length })}</span>
            <CopyButton text={text} />
          </div>
          <pre data-testid="rn-out" style={{ fontSize: out.length === 1 ? "2.4rem" : undefined, fontWeight: out.length === 1 ? 700 : undefined }}>{text}</pre>
        </div>
      )}
      <p className="muted" style={{ fontSize: "0.85rem" }}>{t("random.note")}</p>
    </div>
  );
}

// ── Stopwatch & timer ────────────────────────────────────────────────────────
function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.35, 0.7].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.25, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.3);
    });
    setTimeout(() => void ctx.close(), 1500);
  } catch {
    /* audio unavailable */
  }
}

export function StopwatchTimer() {
  const t = useT("tools-util");
  const [mode, setMode] = useState<"stopwatch" | "timer">("stopwatch");
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0); // ms accumulated before the current run
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [laps, setLaps] = useState<number[]>([]);
  const [minutes, setMinutes] = useState("5");
  const [seconds, setSeconds] = useState("0");
  const [done, setDone] = useState(false);
  const raf = useRef<number | null>(null);

  const total = elapsed + (running && startedAt != null ? now - startedAt : 0);
  const target = (Math.max(0, num(minutes) || 0) * 60 + Math.max(0, num(seconds) || 0)) * 1000;
  const remaining = Math.max(0, target - total);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      setNow(performance.now());
      raf.current = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [running]);

  useEffect(() => {
    if (mode === "timer" && running && target > 0 && remaining <= 0) {
      setRunning(false);
      setElapsed(target);
      setStartedAt(null);
      setDone(true);
      beep();
    }
  }, [mode, running, remaining, target]);

  const start = () => {
    const t = performance.now();
    setStartedAt(t);
    setNow(t);
    setRunning(true);
    setDone(false);
  };
  const pause = () => {
    setElapsed(total);
    setStartedAt(null);
    setRunning(false);
  };
  const reset = () => {
    setRunning(false);
    setElapsed(0);
    setStartedAt(null);
    setLaps([]);
    setDone(false);
  };
  const switchMode = (m: "stopwatch" | "timer") => {
    reset();
    setMode(m);
  };

  const shown = mode === "stopwatch" ? total / 1000 : remaining / 1000;
  return (
    <div className="stack" style={{ gap: 16 }}>
      <Segmented label={t("clock.mode")} value={mode} onChange={switchMode} options={[{ value: "stopwatch", label: t("clock.stopwatch") }, { value: "timer", label: t("clock.timer") }]} />
      {mode === "timer" && !running && total === 0 && (
        <div className="form-grid cols-2">
          <Field label={t("clock.minutes")} htmlFor="sw-min"><NumberInput id="sw-min" value={minutes} onChange={setMinutes} min={0} step={1} /></Field>
          <Field label={t("clock.seconds")} htmlFor="sw-sec"><NumberInput id="sw-sec" value={seconds} onChange={setSeconds} min={0} max={59} step={1} /></Field>
        </div>
      )}
      <div className="clock-face" aria-live="off" data-testid="sw-display">{formatClock(shown, mode === "stopwatch")}</div>
      <div className="row" style={{ gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        {running ? (
          <button type="button" className="btn btn-primary" onClick={pause}><Pause aria-hidden /> {t("clock.pause")}</button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={start} disabled={mode === "timer" && (target <= 0 || remaining <= 0)}>
            <Play aria-hidden /> {total > 0 && !done ? t("clock.resume") : t("clock.start")}
          </button>
        )}
        {mode === "stopwatch" && <button type="button" className="btn" onClick={() => setLaps((l) => [total, ...l])} disabled={!running}><Flag aria-hidden /> {t("clock.lap")}</button>}
        <button type="button" className="btn" onClick={reset} disabled={total === 0 && !running}><RotateCcw aria-hidden /> {t("clock.reset")}</button>
      </div>
      {done && <Notice kind="success">{t("clock.done")}</Notice>}
      {laps.length > 0 && (
        <ol className="lap-list" reversed>
          {laps.map((lap, i) => (
            <li key={laps.length - i}>
              <span className="muted">{t("clock.lapNumber", { n: laps.length - i })}</span> <code>{formatClock((lap - (laps[i + 1] ?? 0)) / 1000, true)}</code> <span className="muted">{t("clock.lapTotal", { time: formatClock(lap / 1000, true) })}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="muted" style={{ fontSize: "0.85rem", textAlign: "center" }}>{t("clock.note")}</p>
    </div>
  );
}
