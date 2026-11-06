"use client";
import { RefreshCw, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CopyButton, Field, Notice, Output, Segmented } from "./ui";
import { base64Decode, base64Encode, decodeJwt, formatJson, HASH_ALGOS, hashBytes, urlDecode, urlEncode, type HashAlgo } from "@/lib/tools/encoding";
import { uuidV4, uuidV7 } from "@/lib/tools/random";
import { runRegex } from "@/lib/tools/formats";

// ── JSON ────────────────────────────────────────────────────────────────────

const SAMPLE_JSON = '{"name":"YoniXTools","tools":["json-formatter","qr-code-generator"],"free":true,"version":1}';

export function JsonFormatter() {
  const [input, setInput] = useState(SAMPLE_JSON);
  const [mode, setMode] = useState<"format" | "minify">("format");
  const [indent, setIndent] = useState<"2" | "4" | "tab">("2");
  const [sortKeys, setSortKeys] = useState(false);
  const res = useMemo(() => formatJson(input, { indent: mode === "minify" ? 0 : indent === "tab" ? "tab" : Number(indent), sortKeys }), [input, mode, indent, sortKeys]);
  return (
    <div className="stack" style={{ gap: 16 }}>
      <Field label="JSON input" htmlFor="json-in">
        <textarea id="json-in" className="textarea mono" value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} style={{ minHeight: 200 }} />
      </Field>
      <div className="row">
        <Segmented label="Mode" value={mode} onChange={setMode} options={[{ value: "format", label: "Format" }, { value: "minify", label: "Minify" }]} />
        {mode === "format" && <Segmented label="Indentation" value={indent} onChange={setIndent} options={[{ value: "2", label: "2 spaces" }, { value: "4", label: "4 spaces" }, { value: "tab", label: "Tabs" }]} />}
        <label className="check">
          <input type="checkbox" checked={sortKeys} onChange={(e) => setSortKeys(e.target.checked)} /> Sort keys
        </label>
      </div>
      {res.ok ? (
        <>
          <Notice kind="success">Valid JSON</Notice>
          <Output label="Result" text={res.output} filename="formatted.json" />
        </>
      ) : (
        input.trim() && (
          <Notice kind="error">
            <strong>Invalid JSON{res.error.line ? ` at line ${res.error.line}, column ${res.error.column}` : ""}</strong>
            {res.error.message}
          </Notice>
        )
      )}
    </div>
  );
}

// ── Base64 / URL ────────────────────────────────────────────────────────────

function useTransform(fn: () => string): { out: string; err: string } {
  try {
    return { out: fn(), err: "" };
  } catch (e) {
    return { out: "", err: (e as Error).message };
  }
}

export function Base64Tool() {
  const [mode, setMode] = useState<"encode" | "decode">("encode");
  const [input, setInput] = useState("Hello, YoniXTools! 👋");
  const [urlSafe, setUrlSafe] = useState(false);
  const { out, err } = useTransform(() => (input ? (mode === "encode" ? base64Encode(input, urlSafe) : base64Decode(input)) : ""));
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row">
        <Segmented label="Direction" value={mode} onChange={setMode} options={[{ value: "encode", label: "Encode" }, { value: "decode", label: "Decode" }]} />
        {mode === "encode" && (
          <label className="check">
            <input type="checkbox" checked={urlSafe} onChange={(e) => setUrlSafe(e.target.checked)} /> URL-safe (base64url)
          </label>
        )}
        <button type="button" className="btn btn-sm btn-ghost" disabled={!out} onClick={() => (setInput(out), setMode(mode === "encode" ? "decode" : "encode"))}>
          <RefreshCw aria-hidden /> Swap
        </button>
      </div>
      <Field label={mode === "encode" ? "Text" : "Base64"} htmlFor="b64-in">
        <textarea id="b64-in" className="textarea mono" value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} />
      </Field>
      {err ? <Notice kind="error">{err}</Notice> : <Output label={mode === "encode" ? "Base64" : "Text"} text={out} />}
    </div>
  );
}

export function UrlTool() {
  const [mode, setMode] = useState<"encode" | "decode">("encode");
  const [scope, setScope] = useState<"component" | "full">("component");
  const [input, setInput] = useState("name=Jane Doe&city=São Paulo");
  const { out, err } = useTransform(() => (input ? (mode === "encode" ? urlEncode(input, scope) : urlDecode(input, scope)) : ""));
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row">
        <Segmented label="Direction" value={mode} onChange={setMode} options={[{ value: "encode", label: "Encode" }, { value: "decode", label: "Decode" }]} />
        <Segmented label="Scope" value={scope} onChange={setScope} options={[{ value: "component", label: "Component" }, { value: "full", label: "Full URL" }]} />
      </div>
      <Field label="Input" htmlFor="url-in">
        <textarea id="url-in" className="textarea mono" value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} />
      </Field>
      {err ? <Notice kind="error">{err}</Notice> : <Output label="Output" text={out} />}
    </div>
  );
}

// ── UUID ────────────────────────────────────────────────────────────────────

export function UuidTool() {
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
        <Field label="Version">
          <Segmented label="Version" value={version} onChange={setVersion} options={[{ value: "4", label: "v4 random" }, { value: "7", label: "v7 time-ordered" }]} />
        </Field>
        <Field label="How many" htmlFor="uuid-n">
          <input id="uuid-n" className="input" type="number" min={1} max={1000} value={count} onChange={(e) => setCount(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))} style={{ width: 110 }} />
        </Field>
        <button type="button" className="btn btn-primary" onClick={generate}>
          <RefreshCw aria-hidden /> Generate
        </button>
      </div>
      <div className="row">
        <label className="check">
          <input type="checkbox" checked={upper} onChange={(e) => setUpper(e.target.checked)} /> Uppercase
        </label>
        <label className="check">
          <input type="checkbox" checked={hyphens} onChange={(e) => setHyphens(e.target.checked)} /> Hyphens
        </label>
      </div>
      <Output label={`${list.length} UUID${list.length === 1 ? "" : "s"}`} text={text} filename="uuids.txt" />
    </div>
  );
}

// ── JWT ─────────────────────────────────────────────────────────────────────

const SAMPLE_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkphbmUgRG9lIiwiaWF0IjoxNzYyNDAwMDAwLCJleHAiOjE3OTM5MzYwMDB9.c2lnbmF0dXJlLW5vdC12ZXJpZmllZA";

export function JwtTool() {
  const [token, setToken] = useState(SAMPLE_JWT);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);
  const res = useMemo(() => {
    if (!token.trim() || now === null) return null;
    try {
      return { ok: true as const, d: decodeJwt(token, now) };
    } catch (e) {
      return { ok: false as const, err: (e as Error).message };
    }
  }, [token, now]);
  return (
    <div className="stack" style={{ gap: 16 }}>
      <Field label="Token" htmlFor="jwt-in">
        <textarea id="jwt-in" className="textarea mono" value={token} onChange={(e) => setToken(e.target.value)} spellCheck={false} style={{ minHeight: 110 }} />
      </Field>
      {res && !res.ok && <Notice kind="error">{res.err}</Notice>}
      {res?.ok && (
        <>
          <div className="row">
            {res.d.expired === true && <span className="badge" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>Expired</span>}
            {res.d.expired === false && <span className="badge badge-live">Not expired</span>}
            {res.d.expired === null && <span className="badge badge-neutral">No expiry (exp) claim</span>}
            {res.d.notYetValid && <span className="badge badge-pending">Not valid yet (nbf)</span>}
            <span className="badge badge-neutral">Signature not verified</span>
          </div>
          {res.d.times.length > 0 && (
            <div className="table-wrap">
              <table className="data">
                <tbody>
                  {res.d.times.map((t) => (
                    <tr key={t.claim}>
                      <td>{{ exp: "Expires (exp)", iat: "Issued (iat)", nbf: "Not before (nbf)" }[t.claim]}</td>
                      <td>{t.date.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="form-grid cols-2">
            <Output label="Header" text={JSON.stringify(res.d.header, null, 2)} />
            <Output label="Payload" text={JSON.stringify(res.d.payload, null, 2)} />
          </div>
        </>
      )}
    </div>
  );
}

// ── Hashes ──────────────────────────────────────────────────────────────────

export function HashTool() {
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
          setError("Files over 1 GB are too large to hash in the browser.");
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
    })().catch((e) => alive && (setError((e as Error).message), setBusy(false)));
    return () => {
      alive = false;
    };
  }, [source, text, file]);

  const exp = expected.trim().toLowerCase();
  const match = exp ? HASH_ALGOS.find((a) => hashes[a] === exp) : undefined;

  return (
    <div className="stack" style={{ gap: 16 }}>
      <Segmented label="Input" value={source} onChange={setSource} options={[{ value: "text", label: "Text" }, { value: "file", label: "File" }]} />
      {source === "text" ? (
        <Field label="Text" htmlFor="hash-text">
          <textarea id="hash-text" className="textarea mono" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type or paste text" style={{ minHeight: 120 }} />
        </Field>
      ) : (
        <label className="dropzone">
          <Upload aria-hidden />
          <strong>{file ? file.name : "Choose a file"}</strong>
          <span className="muted" style={{ fontSize: "0.88rem" }}>{file ? `${(file.size / 1_000_000).toFixed(2)} MB` : "Hashed locally, never uploaded"}</span>
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
      <Field label="Compare with an expected checksum" htmlFor="hash-exp">
        <input id="hash-exp" className="input mono" value={expected} onChange={(e) => setExpected(e.target.value)} placeholder="Paste a published hash" />
      </Field>
      {exp && (match ? <Notice kind="success">Match: {match}</Notice> : <Notice kind="error">No match with any of the hashes above.</Notice>)}
    </div>
  );
}

// ── Regex ───────────────────────────────────────────────────────────────────

const FLAGS = ["g", "i", "m", "s", "u", "y", "d"] as const;

export function RegexTool() {
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
      <Field label="Pattern" htmlFor="re-p">
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="mono muted">/</span>
          <input id="re-p" className="input mono" value={pattern} onChange={(e) => setPattern(e.target.value)} spellCheck={false} />
          <span className="mono muted">/{flags}</span>
        </div>
      </Field>
      <div className="row" role="group" aria-label="Flags">
        {FLAGS.map((f) => (
          <label key={f} className="check mono">
            <input type="checkbox" checked={flags.includes(f)} onChange={(e) => setFlags(e.target.checked ? flags + f : flags.replace(f, ""))} /> {f}
          </label>
        ))}
      </div>
      <Field label="Test text" htmlFor="re-t">
        <textarea id="re-t" className="textarea mono" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
      </Field>
      {!res.ok ? (
        <Notice kind="error">{res.error}</Notice>
      ) : (
        <>
          <div className="output">
            <div className="output-head">
              <span className="field-label" data-testid="regex-count">
                {res.matches.length} match{res.matches.length === 1 ? "" : "es"}
                {res.truncated ? " (first 1,000 shown)" : ""}
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
                    <th style={{ textAlign: "left" }}>Match</th>
                    {res.matches[0].groups.map((_, i) => (
                      <th key={i} style={{ textAlign: "left" }}>
                        Group {i + 1}
                      </th>
                    ))}
                    {Object.keys(res.matches[0].named).length > 0 && <th style={{ textAlign: "left" }}>Named groups</th>}
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

