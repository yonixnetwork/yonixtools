"use client";
import { RefreshCw, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useFormat, useT } from "@/i18n/client";
import { isUserError } from "@/i18n/errors";
import type { Translator } from "@/i18n/translator";
import { CopyButton, Field, Notice, Output, Segmented } from "./ui";
import { base64Decode, base64Encode, decodeJwt, formatJson, HASH_ALGOS, hashBytes, urlDecode, urlEncode, type HashAlgo } from "@/lib/tools/encoding";
import { uuidV4, uuidV7 } from "@/lib/tools/random";
import { runRegex } from "@/lib/tools/formats";

// ── JSON ────────────────────────────────────────────────────────────────────

const SAMPLE_JSON = '{"name":"YoniXTools","tools":["json-formatter","qr-code-generator"],"free":true,"version":1}';

/** Text for a caught error: translated UserError, or a generic message. */
const errText = (t: Translator, e: unknown) => (isUserError(e) ? t(e.key, e.vars) : t("errors.generic"));

export function JsonFormatter() {
  const t = useT("tools-dev");
  const [input, setInput] = useState(SAMPLE_JSON);
  const [mode, setMode] = useState<"format" | "minify">("format");
  const [indent, setIndent] = useState<"2" | "4" | "tab">("2");
  const [sortKeys, setSortKeys] = useState(false);
  const res = useMemo(() => formatJson(input, { indent: mode === "minify" ? 0 : indent === "tab" ? "tab" : Number(indent), sortKeys }), [input, mode, indent, sortKeys]);
  return (
    <div className="stack" style={{ gap: 16 }}>
      <Field label={t("json.input")} htmlFor="json-in">
        <textarea id="json-in" className="textarea mono" value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} style={{ minHeight: 200 }} />
      </Field>
      <div className="row">
        <Segmented label={t("json.mode")} value={mode} onChange={setMode} options={[{ value: "format", label: t("json.format") }, { value: "minify", label: t("json.minify") }]} />
        {mode === "format" && <Segmented label={t("json.indentation")} value={indent} onChange={setIndent} options={[{ value: "2", label: t("json.spaces", { count: 2 }) }, { value: "4", label: t("json.spaces", { count: 4 }) }, { value: "tab", label: t("json.tabs") }]} />}
        <label className="check">
          <input type="checkbox" checked={sortKeys} onChange={(e) => setSortKeys(e.target.checked)} /> {t("json.sortKeys")}
        </label>
      </div>
      {res.ok ? (
        <>
          <Notice kind="success">{t("json.valid")}</Notice>
          <Output label={t("json.result")} text={res.output} filename="formatted.json" />
        </>
      ) : (
        input.trim() && (
          <Notice kind="error">
            <strong>{res.error.line ? t("json.invalidAt", { line: res.error.line, column: res.error.column ?? 0 }) : t("json.invalid")}</strong>
            {res.error.message}
          </Notice>
        )
      )}
    </div>
  );
}

// ── Base64 / URL ────────────────────────────────────────────────────────────

function useTransform(fn: () => string, t: Translator): { out: string; err: string } {
  try {
    return { out: fn(), err: "" };
  } catch (e) {
    return { out: "", err: errText(t, e) };
  }
}

export function Base64Tool() {
  const t = useT("tools-dev");
  const [mode, setMode] = useState<"encode" | "decode">("encode");
  const [input, setInput] = useState("Hello, YoniXTools! 👋");
  const [urlSafe, setUrlSafe] = useState(false);
  const { out, err } = useTransform(() => (input ? (mode === "encode" ? base64Encode(input, urlSafe) : base64Decode(input)) : ""), t);
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row">
        <Segmented label={t("common.direction")} value={mode} onChange={setMode} options={[{ value: "encode", label: t("common.encode") }, { value: "decode", label: t("common.decode") }]} />
        {mode === "encode" && (
          <label className="check">
            <input type="checkbox" checked={urlSafe} onChange={(e) => setUrlSafe(e.target.checked)} /> {t("base64.urlSafe")}
          </label>
        )}
        <button type="button" className="btn btn-sm btn-ghost" disabled={!out} onClick={() => (setInput(out), setMode(mode === "encode" ? "decode" : "encode"))}>
          <RefreshCw aria-hidden /> {t("common.swap")}
        </button>
      </div>
      <Field label={mode === "encode" ? t("common.text") : "Base64"} htmlFor="b64-in">
        <textarea id="b64-in" className="textarea mono" value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} />
      </Field>
      {err ? <Notice kind="error">{err}</Notice> : <Output label={mode === "encode" ? "Base64" : t("common.text")} text={out} />}
    </div>
  );
}

export function UrlTool() {
  const t = useT("tools-dev");
  const [mode, setMode] = useState<"encode" | "decode">("encode");
  const [scope, setScope] = useState<"component" | "full">("component");
  const [input, setInput] = useState("name=Jane Doe&city=São Paulo");
  const { out, err } = useTransform(() => (input ? (mode === "encode" ? urlEncode(input, scope) : urlDecode(input, scope)) : ""), t);
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row">
        <Segmented label={t("common.direction")} value={mode} onChange={setMode} options={[{ value: "encode", label: t("common.encode") }, { value: "decode", label: t("common.decode") }]} />
        <Segmented label={t("url.scope")} value={scope} onChange={setScope} options={[{ value: "component", label: t("url.component") }, { value: "full", label: t("url.full") }]} />
      </div>
      <Field label={t("common.input")} htmlFor="url-in">
        <textarea id="url-in" className="textarea mono" value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} />
      </Field>
      {err ? <Notice kind="error">{err}</Notice> : <Output label={t("common.output")} text={out} />}
    </div>
  );
}

// ── UUID ────────────────────────────────────────────────────────────────────

export function UuidTool() {
  const t = useT("tools-dev");
  const [version, setVersion] = useState<"4" | "7">("4");
  const [count, setCount] = useState(5);
  const [upper, setUpper] = useState(false);
  const [hyphens, setHyphens] = useState(true);
  const [list, setList] = useState<string[]>([]);
  const generate = () => setList(Array.from({ length: Math.max(1, Math.min(1000, count || 1)) }, () => (version === "4" ? uuidV4() : uuidV7())));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(generate, [version, count]);
  const text = list.map((u) => (hyphens ? u : u.replace(/-/g, ""))).map((u) => (upper ? u.toUpperCase() : u)).join("\n");
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row" style={{ alignItems: "flex-end" }}>
        <Field label={t("uuid.version")}>
          <Segmented label={t("uuid.version")} value={version} onChange={setVersion} options={[{ value: "4", label: t("uuid.v4") }, { value: "7", label: t("uuid.v7") }]} />
        </Field>
        <Field label={t("uuid.howMany")} htmlFor="uuid-n">
          <input id="uuid-n" className="input" type="number" min={1} max={1000} value={count} onChange={(e) => setCount(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))} style={{ width: 110 }} />
        </Field>
        <button type="button" className="btn btn-primary" onClick={generate}>
          <RefreshCw aria-hidden /> {t("uuid.generate")}
        </button>
      </div>
      <div className="row">
        <label className="check">
          <input type="checkbox" checked={upper} onChange={(e) => setUpper(e.target.checked)} /> {t("uuid.uppercase")}
        </label>
        <label className="check">
          <input type="checkbox" checked={hyphens} onChange={(e) => setHyphens(e.target.checked)} /> {t("uuid.hyphens")}
        </label>
      </div>
      <Output label={t("uuid.count", { count: list.length })} text={text} filename="uuids.txt" />
    </div>
  );
}

// ── JWT ─────────────────────────────────────────────────────────────────────

const SAMPLE_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkphbmUgRG9lIiwiaWF0IjoxNzYyNDAwMDAwLCJleHAiOjE3OTM5MzYwMDB9.c2lnbmF0dXJlLW5vdC12ZXJpZmllZA";

export function JwtTool() {
  const t = useT("tools-dev");
  const f = useFormat();
  const [token, setToken] = useState(SAMPLE_JWT);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);
  const res = useMemo(() => {
    if (!token.trim() || now === null) return null;
    try {
      return { ok: true as const, d: decodeJwt(token, now) };
    } catch (e) {
      return { ok: false as const, err: errText(t, e) };
    }
  }, [token, now, t]);
  return (
    <div className="stack" style={{ gap: 16 }}>
      <Field label={t("jwt.token")} htmlFor="jwt-in">
        <textarea id="jwt-in" className="textarea mono" value={token} onChange={(e) => setToken(e.target.value)} spellCheck={false} style={{ minHeight: 110 }} />
      </Field>
      {res && !res.ok && <Notice kind="error">{res.err}</Notice>}
      {res?.ok && (
        <>
          <div className="row">
            {res.d.expired === true && <span className="badge" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>{t("jwt.expired")}</span>}
            {res.d.expired === false && <span className="badge badge-live">{t("jwt.notExpired")}</span>}
            {res.d.expired === null && <span className="badge badge-neutral">{t("jwt.noExp")}</span>}
            {res.d.notYetValid && <span className="badge badge-pending">{t("jwt.notYetValid")}</span>}
            <span className="badge badge-neutral">{t("jwt.unverified")}</span>
          </div>
          {res.d.times.length > 0 && (
            <div className="table-wrap">
              <table className="data">
                <tbody>
                  {res.d.times.map((c) => (
                    <tr key={c.claim}>
                      <td>{t({ exp: "jwt.claimExp", iat: "jwt.claimIat", nbf: "jwt.claimNbf" }[c.claim])}</td>
                      <td>{f.date(c.date, { dateStyle: "medium", timeStyle: "medium" })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="form-grid cols-2">
            <Output label={t("jwt.header")} text={JSON.stringify(res.d.header, null, 2)} />
            <Output label={t("jwt.payload")} text={JSON.stringify(res.d.payload, null, 2)} />
          </div>
        </>
      )}
    </div>
  );
}

// ── Hashes ──────────────────────────────────────────────────────────────────

export function HashTool() {
  const t = useT("tools-dev");
  const f = useFormat();
  const [source, setSource] = useState<"text" | "file">("text");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [hashes, setHashes] = useState<Partial<Record<HashAlgo, string>>>({});
  const [expected, setExpected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setError("");
      let data: BufferSource | null = null;
      if (source === "text") data = new TextEncoder().encode(text);
      else if (file) {
        if (file.size > 1_000_000_000) {
          setError(t("hash.tooLarge"));
          return;
        }
        setBusy(true);
        data = await file.arrayBuffer();
      }
      if (!data) return setHashes({});
      const entries = await Promise.all(HASH_ALGOS.map(async (a) => [a, await hashBytes(a, data!)] as const));
      if (alive) {
        setHashes(Object.fromEntries(entries));
        setBusy(false);
      }
    })().catch((e) => alive && (setError(errText(t, e)), setBusy(false)));
    return () => {
      alive = false;
    };
  }, [source, text, file, t]);

  const exp = expected.trim().toLowerCase();
  const match = exp ? HASH_ALGOS.find((a) => hashes[a] === exp) : undefined;

  return (
    <div className="stack" style={{ gap: 16 }}>
      <Segmented label={t("common.input")} value={source} onChange={setSource} options={[{ value: "text", label: t("common.text") }, { value: "file", label: t("hash.file") }]} />
      {source === "text" ? (
        <Field label={t("common.text")} htmlFor="hash-text">
          <textarea id="hash-text" className="textarea mono" value={text} onChange={(e) => setText(e.target.value)} placeholder={t("hash.placeholder")} style={{ minHeight: 120 }} />
        </Field>
      ) : (
        <label className="dropzone">
          <Upload aria-hidden />
          <strong>{file ? file.name : t("hash.chooseFile")}</strong>
          <span className="muted" style={{ fontSize: "0.88rem" }}>{file ? f.number(file.size / 1_000_000, { style: "unit", unit: "megabyte", unitDisplay: "short", minimumFractionDigits: 2, maximumFractionDigits: 2 }) : t("hash.local")}</span>
          <input type="file" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
      )}
      {error && <Notice kind="error">{error}</Notice>}
      <div className="table-wrap">
        <table className="data">
          <tbody>
            {HASH_ALGOS.map((a) => (
              <tr key={a}>
                <td style={{ width: 90 }}>{a}</td>
                <td className="mono" style={{ textAlign: "left", whiteSpace: "normal", wordBreak: "break-all", fontSize: "0.82rem" }} data-testid={`hash-${a}`}>
                  {busy ? "…" : hashes[a] ?? "—"}
                </td>
                <td style={{ width: 90 }}>{hashes[a] && <CopyButton text={hashes[a]!} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Field label={t("hash.compare")} htmlFor="hash-exp">
        <input id="hash-exp" className="input mono" value={expected} onChange={(e) => setExpected(e.target.value)} placeholder={t("hash.comparePlaceholder")} />
      </Field>
      {exp && (match ? <Notice kind="success">{t("hash.match", { algo: match })}</Notice> : <Notice kind="error">{t("hash.noMatch")}</Notice>)}
    </div>
  );
}

// ── Regex ───────────────────────────────────────────────────────────────────

const FLAGS = ["g", "i", "m", "s", "u", "y", "d"] as const;

export function RegexTool() {
  const t = useT("tools-dev");
  const [pattern, setPattern] = useState("(?<user>[\\w.+-]+)@(?<domain>[\\w-]+\\.[\\w.]+)");
  const [flags, setFlags] = useState("g");
  const [text, setText] = useState("Contact hello@yonixtools.com or support@example.org for help.");
  const res = useMemo(() => runRegex(pattern, flags, text), [pattern, flags, text]);

  const highlighted = useMemo(() => {
    if (!res.ok || !res.matches.length) return [text];
    const parts: React.ReactNode[] = [];
    let last = 0;
    res.matches.forEach((m, i) => {
      if (m.end === m.index) return;
      parts.push(text.slice(last, m.index));
      parts.push(
        <mark key={i} className="hl" style={{ color: "inherit" }}>
          {text.slice(m.index, m.end)}
        </mark>,
      );
      last = m.end;
    });
    parts.push(text.slice(last));
    return parts;
  }, [res, text]);

  return (
    <div className="stack" style={{ gap: 16 }}>
      <Field label={t("regex.pattern")} htmlFor="re-p">
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="mono muted">/</span>
          <input id="re-p" className="input mono" value={pattern} onChange={(e) => setPattern(e.target.value)} spellCheck={false} />
          <span className="mono muted">/{flags}</span>
        </div>
      </Field>
      <div className="row" role="group" aria-label={t("regex.flags")}>
        {FLAGS.map((f) => (
          <label key={f} className="check mono">
            <input type="checkbox" checked={flags.includes(f)} onChange={(e) => setFlags(e.target.checked ? flags + f : flags.replace(f, ""))} /> {f}
          </label>
        ))}
      </div>
      <Field label={t("regex.testText")} htmlFor="re-t">
        <textarea id="re-t" className="textarea mono" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
      </Field>
      {!res.ok ? (
        <Notice kind="error">{res.error}</Notice>
      ) : (
        <>
          <div className="output">
            <div className="output-head">
              <span className="field-label" data-testid="regex-count">
                {res.truncated ? t("regex.countTruncated", { count: res.matches.length, shown: 1000 }) : t("regex.count", { count: res.matches.length })}
              </span>
            </div>
            <pre>{highlighted}</pre>
          </div>
          {res.matches.length > 0 && res.matches.some((m) => m.groups.length) && (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>#</th>
                    <th style={{ textAlign: "left" }}>{t("regex.match")}</th>
                    {res.matches[0].groups.map((_, i) => (
                      <th key={i} style={{ textAlign: "left" }}>
                        {t("regex.group", { n: i + 1 })}
                      </th>
                    ))}
                    {Object.keys(res.matches[0].named).length > 0 && <th style={{ textAlign: "left" }}>{t("regex.named")}</th>}
                  </tr>
                </thead>
                <tbody>
                  {res.matches.slice(0, 100).map((m, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td className="mono" style={{ textAlign: "left" }}>{m.text}</td>
                      {m.groups.map((g, j) => (
                        <td key={j} className="mono" style={{ textAlign: "left" }}>
                          {g ?? <span className="muted">—</span>}
                        </td>
                      ))}
                      {Object.keys(m.named).length > 0 && (
                        <td className="mono" style={{ textAlign: "left" }}>
                          {Object.entries(m.named)
                            .map(([k, v]) => `${k}: ${v ?? "—"}`)
                            .join(", ")}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

