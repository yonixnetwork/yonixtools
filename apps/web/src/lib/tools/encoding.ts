// ── Base64 (UTF-8 safe) ─────────────────────────────────────────────────────

export function base64Encode(text: string, urlSafe = false): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const b64 = btoa(bin);
  return urlSafe ? b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : b64;
}

export function base64DecodeBytes(input: string): Uint8Array {
  let s = input.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s)) throw new Error("Input contains characters that are not valid Base64.");
  s = s.replace(/=+$/, "");
  if (s.length % 4 === 1) throw new Error("Input has an invalid length for Base64.");
  s += "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function base64Decode(input: string): string {
  const bytes = base64DecodeBytes(input);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("Decoded data is binary, not UTF-8 text.");
  }
}

// ── URL encoding ────────────────────────────────────────────────────────────

export function urlEncode(s: string, mode: "component" | "full"): string {
  return mode === "component" ? encodeURIComponent(s) : encodeURI(s);
}

export function urlDecode(s: string, mode: "component" | "full", plusAsSpace = true): string {
  const input = plusAsSpace ? s.replace(/\+/g, " ") : s;
  try {
    return mode === "component" ? decodeURIComponent(input) : decodeURI(input);
  } catch {
    throw new Error("The text contains a malformed percent-encoded sequence (for example a lone % sign).");
  }
}

// ── JWT ─────────────────────────────────────────────────────────────────────

export interface DecodedJwt {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string;
  times: Array<{ claim: "exp" | "iat" | "nbf"; date: Date }>;
  expired: boolean | null;
  notYetValid: boolean;
}

export function decodeJwt(token: string, now = Date.now()): DecodedJwt {
  const parts = token.trim().replace(/^Bearer\s+/i, "").split(".");
  if (parts.length !== 3) throw new Error(`A JWT has three dot-separated parts; this has ${parts.length}.`);
  const parse = (part: string, name: string) => {
    let obj: unknown;
    try {
      obj = JSON.parse(base64Decode(part));
    } catch {
      throw new Error(`The ${name} is not valid Base64url-encoded JSON.`);
    }
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) throw new Error(`The ${name} must be a JSON object.`);
    return obj as Record<string, unknown>;
  };
  const header = parse(parts[0], "header");
  const payload = parse(parts[1], "payload");
  const times: DecodedJwt["times"] = [];
  for (const claim of ["iat", "nbf", "exp"] as const) {
    const v = payload[claim];
    if (typeof v === "number" && Number.isFinite(v)) times.push({ claim, date: new Date(v * 1000) });
  }
  const exp = typeof payload.exp === "number" ? payload.exp * 1000 : null;
  const nbf = typeof payload.nbf === "number" ? payload.nbf * 1000 : null;
  return { header, payload, signature: parts[2], times, expired: exp === null ? null : exp <= now, notYetValid: nbf !== null && nbf > now };
}

// ── JSON ────────────────────────────────────────────────────────────────────

export interface JsonError {
  message: string;
  line?: number;
  column?: number;
}

function locate(text: string, message: string): JsonError {
  // V8: "... at position 12 (line 2 column 5)" ; Firefox: "at line 2 column 5"
  const lc = message.match(/line (\d+) column (\d+)/);
  if (lc) return { message, line: +lc[1], column: +lc[2] };
  const pos = message.match(/position (\d+)/);
  if (pos) {
    const p = +pos[1];
    const before = text.slice(0, p);
    const line = before.split("\n").length;
    return { message, line, column: p - before.lastIndexOf("\n") };
  }
  return { message };
}

function sortKeysDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeysDeep);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.keys(v as object)
        .sort()
        .map((k) => [k, sortKeysDeep((v as Record<string, unknown>)[k])]),
    );
  }
  return v;
}

export function formatJson(text: string, opts: { indent: number | "tab" | 0; sortKeys?: boolean }): { ok: true; output: string } | { ok: false; error: JsonError } {
  if (!text.trim()) return { ok: false, error: { message: "Paste some JSON first." } };
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: locate(text, (e as Error).message) };
  }
  if (opts.sortKeys) value = sortKeysDeep(value);
  const indent = opts.indent === "tab" ? "\t" : opts.indent;
  return { ok: true, output: JSON.stringify(value, null, indent || undefined) };
}

// ── Hashes ──────────────────────────────────────────────────────────────────

export const HASH_ALGOS = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"] as const;
export type HashAlgo = (typeof HASH_ALGOS)[number];

export async function hashBytes(algo: HashAlgo, data: BufferSource): Promise<string> {
  const buf = await crypto.subtle.digest(algo, data);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export const hashText = (algo: HashAlgo, text: string) => hashBytes(algo, new TextEncoder().encode(text));
