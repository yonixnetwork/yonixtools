"use client";
import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CopyButton, Field, Notice, Output, Segmented } from "./ui";
import { convertCase, diffLines, lorem, textStats, topKeywords, type CaseStyle } from "@/lib/tools/text";
import { useFormat, useT } from "@/i18n/client";
import { isUserError } from "@/i18n/errors";
import type { Translator } from "@/i18n/translator";
import { generatePassword, passwordEntropyBits, strengthLabel, type PasswordOptions } from "@/lib/tools/random";

const fmtMin = (t: Translator, m: number) => (m < 1 ? t("words.seconds", { sec: Math.max(0, Math.round(m * 60)) }) : t("words.minutesSeconds", { min: Math.floor(m), sec: Math.round((m % 1) * 60) }));

export function WordCounter() {
  const t = useT("tools-text");
  const f = useFormat();
  const [text, setText] = useState("");
  const s = useMemo(() => textStats(text), [text]);
  const kw = useMemo(() => topKeywords(text, 8), [text]);
  // [stable id (data-testid), message key, value]
  const stats: Array<[string, string, string | number]> = [
    ["words", "words.statWords", s.words],
    ["characters", "words.statCharacters", s.characters],
    ["without-spaces", "words.statWithoutSpaces", s.charactersNoSpaces],
    ["sentences", "words.statSentences", s.sentences],
    ["paragraphs", "words.statParagraphs", s.paragraphs],
    ["lines", "words.statLines", s.lines],
    ["reading-time", "words.statReadingTime", fmtMin(t, s.readingMinutes)],
    ["speaking-time", "words.statSpeakingTime", fmtMin(t, s.speakingMinutes)],
  ];
  return (
    <div className="stack" style={{ gap: 16 }}>
      <Field label={t("words.yourText")} htmlFor="wc-text">
        <textarea id="wc-text" className="textarea" value={text} onChange={(e) => setText(e.target.value)} placeholder={t("words.placeholder")} style={{ minHeight: 220 }} />
      </Field>
      <div className="stat-grid" aria-live="polite">
        {stats.map(([id, key, v]) => (
          <div className="stat" key={id}>
            <div className="v" data-testid={`stat-${id}`}>{typeof v === "number" ? f.number(v) : v}</div>
            <div className="k">{t(key)}</div>
          </div>
        ))}
      </div>
      {kw.length > 0 && (
        <div>
          <div className="field-label" style={{ marginBottom: 8 }}>
            {t("words.topKeywords")}
          </div>
          <div className="row" style={{ gap: 6 }}>
            {kw.map((k) => (
              <span key={k.word} className="chip" style={{ cursor: "default" }}>
                {k.word} <span className="muted">{f.number(k.count)} · {f.number(k.percent / 100, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const CASES: CaseStyle[] = ["upper", "lower", "title", "sentence", "camel", "pascal", "snake", "kebab", "constant"];

export function CaseConverter() {
  const t = useT("tools-text");
  const [text, setText] = useState("the quick brown fox jumps over the lazy dog");
  const [style, setStyle] = useState<CaseStyle>("title");
  const out = useMemo(() => convertCase(text, style), [text, style]);
  return (
    <div className="stack" style={{ gap: 16 }}>
      <Field label={t("case.text")} htmlFor="case-in">
        <textarea id="case-in" className="textarea" value={text} onChange={(e) => setText(e.target.value)} />
      </Field>
      <Segmented label={t("case.style")} value={style} onChange={setStyle} options={CASES.map((value) => ({ value, label: t(`case.${value}`) }))} />
      <Output label={t("case.result")} text={out} mono={false} />
    </div>
  );
}

const STRENGTH_COLORS = ["var(--danger)", "var(--warning)", "var(--success)", "var(--success)"];

const STRENGTH_KEYS = ["password.weak", "password.fair", "password.strong", "password.veryStrong"];

export function PasswordGenerator() {
  const t = useT("tools-text");
  const [o, setO] = useState<PasswordOptions>({ length: 20, lower: true, upper: true, digits: true, symbols: true, excludeAmbiguous: false });
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const regen = () => {
    try {
      setPw(generatePassword(o));
      setError("");
    } catch (e) {
      setPw("");
      setError(isUserError(e) && e.key === "password.noCharTypes" ? e.key : "password.error");
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
        <pre className="mono" style={{ fontSize: "1.15rem", padding: "18px 16px", letterSpacing: "0.02em" }} data-testid="password" aria-label={t("password.generatedAria")}>
          {pw || <span className="muted">—</span>}
        </pre>
      </div>
      <div className="row">
        <button type="button" className="btn btn-primary" onClick={regen}>
          <RefreshCw aria-hidden /> {t("password.generate")}
        </button>
        <CopyButton text={pw} label={t("password.copy")} />
      </div>
      {error && <Notice kind="error">{t(error)}</Notice>}
      <div>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 6, fontSize: "0.88rem" }}>
          <strong style={{ color: STRENGTH_COLORS[st.level] }}>{t(STRENGTH_KEYS[st.level])}</strong>
          <span className="muted">{t("password.entropy", { bits: Math.round(bits) })}</span>
        </div>
        <div className="meter">
          <span style={{ width: `${Math.min(100, (bits / 128) * 100)}%`, background: STRENGTH_COLORS[st.level] }} />
        </div>
      </div>
      <Field label={t("password.length", { length: o.length })} htmlFor="pw-len">
        <input id="pw-len" type="range" min={4} max={128} value={o.length} onChange={(e) => setO({ ...o, length: +e.target.value })} />
      </Field>
      <div className="row">
        <label className="check"><input type="checkbox" checked={o.lower} onChange={toggle("lower")} /> {t("password.lowercase")}</label>
        <label className="check"><input type="checkbox" checked={o.upper} onChange={toggle("upper")} /> {t("password.uppercase")}</label>
        <label className="check"><input type="checkbox" checked={o.digits} onChange={toggle("digits")} /> {t("password.numbers")}</label>
        <label className="check"><input type="checkbox" checked={o.symbols} onChange={toggle("symbols")} /> {t("password.symbols")}</label>
        <label className="check"><input type="checkbox" checked={o.excludeAmbiguous} onChange={toggle("excludeAmbiguous")} /> {t("password.excludeLookAlikes")}</label>
      </div>
    </div>
  );
}

export function LoremGenerator() {
  const t = useT("tools-text");
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
        <Field label={t("lorem.generate")}>
          <Segmented label={t("lorem.unit")} value={unit} onChange={setUnit} options={[{ value: "paragraphs", label: t("lorem.paragraphs") }, { value: "sentences", label: t("lorem.sentences") }, { value: "words", label: t("lorem.words") }]} />
        </Field>
        <Field label={t("lorem.howMany")} htmlFor="li-n">
          <input id="li-n" className="input" type="number" min={1} max={unit === "words" ? 5000 : 200} value={count} onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))} style={{ width: 110 }} />
        </Field>
        <button type="button" className="btn" onClick={() => setSeed(Math.floor(Math.random() * 1e9))}>
          <RefreshCw aria-hidden /> {t("lorem.shuffle")}
        </button>
      </div>
      <div className="row">
        <label className="check"><input type="checkbox" checked={classic} onChange={(e) => setClassic(e.target.checked)} /> {t("lorem.startClassic")}</label>
        <label className="check"><input type="checkbox" checked={html} onChange={(e) => setHtml(e.target.checked)} /> {t("lorem.htmlTags", { tag: "<p>" })}</label>
      </div>
      <Output label={t("lorem.output")} text={out} mono={html} />
    </div>
  );
}

export function TextCompare() {
  const t = useT("tools-text");
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
        <Field label={t("compare.original")} htmlFor="diff-a">
          <textarea id="diff-a" className="textarea mono" value={a} onChange={(e) => setA(e.target.value)} spellCheck={false} />
        </Field>
        <Field label={t("compare.changed")} htmlFor="diff-b">
          <textarea id="diff-b" className="textarea mono" value={b} onChange={(e) => setB(e.target.value)} spellCheck={false} />
        </Field>
      </div>
      <div className="row">
        <label className="check"><input type="checkbox" checked={ignoreWs} onChange={(e) => setIgnoreWs(e.target.checked)} /> {t("compare.ignoreWhitespace")}</label>
        <label className="check"><input type="checkbox" checked={ignoreCase} onChange={(e) => setIgnoreCase(e.target.checked)} /> {t("compare.ignoreCase")}</label>
        <span className="badge badge-live" data-testid="diff-added">{t("compare.added", { count: added })}</span>
        <span className="badge" style={{ background: "var(--danger-soft)", color: "var(--danger)" }} data-testid="diff-removed">
          {t("compare.removed", { count: removed })}
        </span>
      </div>
      {diff === null ? (
        <Notice kind="error">{t("compare.tooLarge")}</Notice>
      ) : added + removed === 0 ? (
        <Notice kind="success">{t(ignoreWs || ignoreCase ? "compare.identicalWithOptions" : "compare.identical")}</Notice>
      ) : (
        <div className="diff" role="table" aria-label={t("compare.differencesAria")}>
          {diff.map((d, i) => (
            <div key={i} className={d.type === "same" ? "" : d.type} role="row">
              <span className="n">{d.a ?? ""}</span>
              <span className="n">{d.b ?? ""}</span>
              <span aria-label={d.type === "add" ? t("compare.addedAria") : d.type === "del" ? t("compare.removedAria") : undefined}>{d.type === "add" ? "+" : d.type === "del" ? "−" : " "}</span>
              <span>{d.text || " "}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
