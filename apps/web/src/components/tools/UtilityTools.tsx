"use client";
import { Dices, Flag, Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CopyButton, Field, Notice, NumberInput, num, Segmented } from "./ui";
import { formatClock, randomIntegers } from "@/lib/tools/media";

// ── Random numbers ───────────────────────────────────────────────────────────
export function RandomNumberGenerator() {
  const [min, setMin] = useState("1");
  const [max, setMax] = useState("100");
  const [count, setCount] = useState("1");
  const [unique, setUnique] = useState(true);
  const [sorted, setSorted] = useState(false);
  const [out, setOut] = useState<number[]>([]);
  const [error, setError] = useState("");
  const roll = () => {
    try {
      const xs = randomIntegers(num(min), num(max), num(count), unique);
      setOut(sorted ? [...xs].sort((a, b) => a - b) : xs);
      setError("");
    } catch (e) {
      setOut([]);
      setError(e instanceof Error ? e.message : "Check the numbers.");
    }
  };
  const text = out.join(", ");
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="form-grid cols-3">
        <Field label="Minimum" htmlFor="rn-min"><NumberInput id="rn-min" value={min} onChange={setMin} step={1} /></Field>
        <Field label="Maximum" htmlFor="rn-max"><NumberInput id="rn-max" value={max} onChange={setMax} step={1} /></Field>
        <Field label="How many" htmlFor="rn-count"><NumberInput id="rn-count" value={count} onChange={setCount} min={1} max={10000} step={1} /></Field>
      </div>
      <div className="row" style={{ gap: 16, flexWrap: "wrap" }}>
        <label className="check"><input type="checkbox" checked={unique} onChange={(e) => setUnique(e.target.checked)} /> No repeats</label>
        <label className="check"><input type="checkbox" checked={sorted} onChange={(e) => setSorted(e.target.checked)} /> Sort results</label>
      </div>
      <button type="button" className="btn btn-primary" onClick={roll} style={{ alignSelf: "flex-start" }}>
        <Dices aria-hidden /> Generate
      </button>
      {error && <Notice kind="error">{error}</Notice>}
      {out.length > 0 && (
        <div className="output">
          <div className="output-head">
            <span className="field-label">{out.length === 1 ? "Your number" : `${out.length} numbers`}</span>
            <CopyButton text={text} />
          </div>
          <pre data-testid="rn-out" style={{ fontSize: out.length === 1 ? "2.4rem" : undefined, fontWeight: out.length === 1 ? 700 : undefined }}>{text}</pre>
        </div>
      )}
      <p className="muted" style={{ fontSize: "0.85rem" }}>Uses your browser&apos;s cryptographic random generator, without bias.</p>
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
      <Segmented label="Mode" value={mode} onChange={switchMode} options={[{ value: "stopwatch", label: "Stopwatch" }, { value: "timer", label: "Countdown timer" }]} />
      {mode === "timer" && !running && total === 0 && (
        <div className="form-grid cols-2">
          <Field label="Minutes" htmlFor="sw-min"><NumberInput id="sw-min" value={minutes} onChange={setMinutes} min={0} step={1} /></Field>
          <Field label="Seconds" htmlFor="sw-sec"><NumberInput id="sw-sec" value={seconds} onChange={setSeconds} min={0} max={59} step={1} /></Field>
        </div>
      )}
      <div className="clock-face" aria-live="off" data-testid="sw-display">{formatClock(shown, mode === "stopwatch")}</div>
      <div className="row" style={{ gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        {running ? (
          <button type="button" className="btn btn-primary" onClick={pause}><Pause aria-hidden /> Pause</button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={start} disabled={mode === "timer" && (target <= 0 || remaining <= 0)}>
            <Play aria-hidden /> {total > 0 && !done ? "Resume" : "Start"}
          </button>
        )}
        {mode === "stopwatch" && <button type="button" className="btn" onClick={() => setLaps((l) => [total, ...l])} disabled={!running}><Flag aria-hidden /> Lap</button>}
        <button type="button" className="btn" onClick={reset} disabled={total === 0 && !running}><RotateCcw aria-hidden /> Reset</button>
      </div>
      {done && <Notice kind="success">Time&apos;s up.</Notice>}
      {laps.length > 0 && (
        <ol className="lap-list" reversed>
          {laps.map((t, i) => (
            <li key={laps.length - i}>
              <span className="muted">Lap {laps.length - i}</span> <code>{formatClock((t - (laps[i + 1] ?? 0)) / 1000, true)}</code> <span className="muted">total {formatClock(t / 1000, true)}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="muted" style={{ fontSize: "0.85rem", textAlign: "center" }}>Keep this tab open: browsers slow down timers in background tabs, but the time shown stays accurate.</p>
    </div>
  );
}
