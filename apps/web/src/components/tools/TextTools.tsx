"use client";
import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CopyButton, Field, Notice, Output, Segmented } from "./ui";
import { convertCase, diffLines, lorem, textStats, topKeywords, type CaseStyle } from "@/lib/tools/text";
import { generatePassword, passwordEntropyBits, strengthLabel, type PasswordOptions } from "@/lib/tools/random";

const fmtMin = (m: number) => (m < 1 ? `${Math.max(0, Math.round(m * 60))} sec` : `${Math.floor(m)} min ${Math.round((m % 1) * 60)} sec`);

export function WordCounter() {
  const [text, setText] = useState("");
  const s = useMemo(() => textStats(text), [text]);
  const kw = useMemo(() => topKeywords(text, 8), [text]);
  const stats: Array<[string, string | number]> = [
    ["Words", s.words],
    ["Characters", s.characters],
    ["Without spaces", s.charactersNoSpaces],
    ["Sentences", s.sentences],
    ["Paragraphs", s.paragraphs],
    ["Lines", s.lines],
    ["Reading time", fmtMin(s.readingMinutes)],
    ["Speaking time", fmtMin(s.speakingMinutes)],
  ];
  return (
    <div className="stack" style={{ gap: 16 }}>
      <Field label="Your text" htmlFor="wc-text">
        <textarea id="wc-text" className="textarea" value={text} onChange={(e) => setText(e.target.value)} placeholder="Start typing or paste your text here…" style={{ minHeight: 220 }} />
      </Field>
      <div className="stat-grid" aria-live="polite">
        {stats.map(([k, v]) => (
          <div className="stat" key={k}>
            <div className="v" data-testid={`stat-${k.toLowerCase().replace(/\s+/g, "-")}`}>{typeof v === "number" ? v.toLocaleString() : v}</div>
            <div className="k">{k}</div>
          </div>
        ))}
      </div>
      {kw.length > 0 && (
        <div>
          <div className="field-label" style={{ marginBottom: 8 }}>
            Top keywords
          </div>
          <div className="row" style={{ gap: 6 }}>
            {kw.map((k) => (
              <span key={k.word} className="chip" style={{ cursor: "default" }}>
                {k.word} <span className="muted">{k.count} · {k.percent.toFixed(1)}%</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const CASES: Array<{ value: CaseStyle; label: string }> = [
  { value: "upper", label: "UPPER CASE" },
  { value: "lower", label: "lower case" },
  { value: "title", label: "Title Case" },
  { value: "sentence", label: "Sentence case" },
  { value: "camel", label: "camelCase" },
  { value: "pascal", label: "PascalCase" },
  { value: "snake", label: "snake_case" },
  { value: "kebab", label: "kebab-case" },
  { value: "constant", label: "CONSTANT_CASE" },
];

export function CaseConverter() {
  const [text, setText] = useState("the quick brown fox jumps over the lazy dog");
  const [style, setStyle] = useState<CaseStyle>("title");
  const out = useMemo(() => convertCase(text, style), [text, style]);
  return (
    <div className="stack" style={{ gap: 16 }}>
      <Field label="Text" htmlFor="case-in">
        <textarea id="case-in" className="textarea" value={text} onChange={(e) => setText(e.target.value)} />
      </Field>
      <Segmented label="Case style" value={style} onChange={setStyle} options={CASES} />
      <Output label="Result" text={out} mono={false} />
    </div>
  );
}

const STRENGTH_COLORS = ["var(--danger)", "var(--warning)", "var(--success)", "var(--success)"];

export function PasswordGenerator() {
  const [o, setO] = useState<PasswordOptions>({ length: 20, lower: true, upper: true, digits: true, symbols: true, excludeAmbiguous: false });
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const regen = () => {
    try {
      setPw(generatePassword(o));
      setError("");
    } catch (e) {
      setPw("");
      setError((e as Error).message);
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(regen, [o]);
  const bits = passwordEntropyBits(o);
  const st = strengthLabel(bits);
  const toggle = (k: keyof PasswordOptions) => (e: React.ChangeEvent<HTMLInputElement>) => setO({ ...o, [k]: e.target.checked });
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="output">
        <pre className="mono" style={{ fontSize: "1.15rem", padding: "18px 16px", letterSpacing: "0.02em" }} data-testid="password" aria-label="Generated password">
          {pw || <span className="muted">—</span>}
        </pre>
      </div>
      <div className="row">
        <button type="button" className="btn btn-primary" onClick={regen}>
          <RefreshCw aria-hidden /> Generate new
        </button>
        <CopyButton text={pw} label="Copy password" />
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      <div>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 6, fontSize: "0.88rem" }}>
          <strong style={{ color: STRENGTH_COLORS[st.level] }}>{st.label}</strong>
          <span className="muted">≈ {Math.round(bits)} bits of entropy</span>
        </div>
        <div className="meter">
          <span style={{ width: `${Math.min(100, (bits / 128) * 100)}%`, background: STRENGTH_COLORS[st.level] }} />
        </div>
      </div>
      <Field label={`Length: ${o.length}`} htmlFor="pw-len">
        <input id="pw-len" type="range" min={4} max={128} value={o.length} onChange={(e) => setO({ ...o, length: +e.target.value })} />
      </Field>
      <div className="row">
        <label className="check"><input type="checkbox" checked={o.lower} onChange={toggle("lower")} /> Lowercase</label>
        <label className="check"><input type="checkbox" checked={o.upper} onChange={toggle("upper")} /> Uppercase</label>
        <label className="check"><input type="checkbox" checked={o.digits} onChange={toggle("digits")} /> Numbers</label>
        <label className="check"><input type="checkbox" checked={o.symbols} onChange={toggle("symbols")} /> Symbols</label>
        <label className="check"><input type="checkbox" checked={o.excludeAmbiguous} onChange={toggle("excludeAmbiguous")} /> Exclude look-alikes</label>
      </div>
    </div>
  );
}

export function LoremGenerator() {
  const [unit, setUnit] = useState<"paragraphs" | "sentences" | "words">("paragraphs");
  const [count, setCount] = useState(3);
  const [classic, setClassic] = useState(true);
  const [html, setHtml] = useState(false);
  const [seed, setSeed] = useState(1);
  const out = useMemo(() => {
    const parts = lorem({ unit, count, startClassic: classic, seed });
    return html ? parts.map((p) => `<p>${p}</p>`).join("\n") : parts.join("\n\n");
  }, [unit, count, classic, html, seed]);
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row" style={{ alignItems: "flex-end" }}>
        <Field label="Generate">
          <Segmented label="Unit" value={unit} onChange={setUnit} options={[{ value: "paragraphs", label: "Paragraphs" }, { value: "sentences", label: "Sentences" }, { value: "words", label: "Words" }]} />
        </Field>
        <Field label="How many" htmlFor="li-n">
          <input id="li-n" className="input" type="number" min={1} max={unit === "words" ? 5000 : 200} value={count} onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))} style={{ width: 110 }} />
        </Field>
        <button type="button" className="btn" onClick={() => setSeed(Math.floor(Math.random() * 1e9))}>
          <RefreshCw aria-hidden /> Shuffle
        </button>
      </div>
      <div className="row">
        <label className="check"><input type="checkbox" checked={classic} onChange={(e) => setClassic(e.target.checked)} /> Start with &quot;Lorem ipsum…&quot;</label>
        <label className="check"><input type="checkbox" checked={html} onChange={(e) => setHtml(e.target.checked)} /> HTML &lt;p&gt; tags</label>
      </div>
      <Output label="Placeholder text" text={out} mono={html} />
    </div>
  );
}

export function TextCompare() {
  const [a, setA] = useState("The quick brown fox\njumps over\nthe lazy dog.");
  const [b, setB] = useState("The quick brown fox\nleaps over\nthe lazy dog.\nThe end.");
  const [ignoreWs, setIgnoreWs] = useState(false);
  const [ignoreCase, setIgnoreCase] = useState(false);
  const diff = useMemo(() => diffLines(a, b, { ignoreWhitespace: ignoreWs, ignoreCase }), [a, b, ignoreWs, ignoreCase]);
  const added = diff?.filter((d) => d.type === "add").length ?? 0;
  const removed = diff?.filter((d) => d.type === "del").length ?? 0;
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="form-grid cols-2">
        <Field label="Original" htmlFor="diff-a">
          <textarea id="diff-a" className="textarea mono" value={a} onChange={(e) => setA(e.target.value)} spellCheck={false} />
        </Field>
        <Field label="Changed" htmlFor="diff-b">
          <textarea id="diff-b" className="textarea mono" value={b} onChange={(e) => setB(e.target.value)} spellCheck={false} />
        </Field>
      </div>
      <div className="row">
        <label className="check"><input type="checkbox" checked={ignoreWs} onChange={(e) => setIgnoreWs(e.target.checked)} /> Ignore whitespace</label>
        <label className="check"><input type="checkbox" checked={ignoreCase} onChange={(e) => setIgnoreCase(e.target.checked)} /> Ignore case</label>
        <span className="badge badge-live" data-testid="diff-added">+{added} added</span>
        <span className="badge" style={{ background: "var(--danger-soft)", color: "var(--danger)" }} data-testid="diff-removed">
          −{removed} removed
        </span>
      </div>
      {diff === null ? (
        <Notice kind="error">These texts are too large to compare in the browser. Try comparing smaller sections.</Notice>
      ) : added + removed === 0 ? (
        <Notice kind="success">The texts are identical{ignoreWs || ignoreCase ? " (with the selected options)" : ""}.</Notice>
      ) : (
        <div className="diff" role="table" aria-label="Differences">
          {diff.map((d, i) => (
            <div key={i} className={d.type === "same" ? "" : d.type} role="row">
              <span className="n">{d.a ?? ""}</span>
              <span className="n">{d.b ?? ""}</span>
              <span aria-label={d.type === "add" ? "added" : d.type === "del" ? "removed" : undefined}>{d.type === "add" ? "+" : d.type === "del" ? "−" : " "}</span>
              <span>{d.text || " "}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
