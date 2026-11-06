type RandomSource = (buf: Uint32Array) => Uint32Array;
const defaultSource: RandomSource = (buf) => crypto.getRandomValues(buf);

/** Unbiased random integer in [0, max) using rejection sampling. */
export function randomInt(max: number, source: RandomSource = defaultSource): number {
  if (max <= 0 || max > 2 ** 32) throw new RangeError("max out of range");
  const limit = Math.floor(2 ** 32 / max) * max;
  const buf = new Uint32Array(1);
  for (;;) {
    source(buf);
    if (buf[0] < limit) return buf[0] % max;
  }
}

// ── Passwords ───────────────────────────────────────────────────────────────

export const CHARSETS = {
  lower: "abcdefghijklmnopqrstuvwxyz",
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  digits: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.<>/?~",
} as const;
const AMBIGUOUS = /[0O1lI|`'"]/g;

export interface PasswordOptions {
  length: number;
  lower: boolean;
  upper: boolean;
  digits: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
}

export function passwordSets(o: PasswordOptions): string[] {
  return (["lower", "upper", "digits", "symbols"] as const)
    .filter((k) => o[k])
    .map((k) => (o.excludeAmbiguous ? CHARSETS[k].replace(AMBIGUOUS, "") : CHARSETS[k]));
}

export function generatePassword(o: PasswordOptions, source: RandomSource = defaultSource): string {
  const sets = passwordSets(o);
  if (!sets.length) throw new Error("Select at least one character type.");
  const length = Math.max(sets.length, Math.min(256, Math.floor(o.length)));
  const all = sets.join("");
  const chars = sets.map((s) => s[randomInt(s.length, source)]);
  while (chars.length < length) chars.push(all[randomInt(all.length, source)]);
  // Fisher–Yates so the guaranteed characters aren't always first.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1, source);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export function passwordEntropyBits(o: PasswordOptions): number {
  const pool = passwordSets(o).join("").length;
  return pool ? o.length * Math.log2(pool) : 0;
}

export function strengthLabel(bits: number): { label: string; level: 0 | 1 | 2 | 3 } {
  if (bits < 50) return { label: "Weak", level: 0 };
  if (bits < 75) return { label: "Fair", level: 1 };
  if (bits < 100) return { label: "Strong", level: 2 };
  return { label: "Very strong", level: 3 };
}

// ── UUIDs ───────────────────────────────────────────────────────────────────

function hex(bytes: Uint8Array): string {
  const h = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function uuidV4(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  return hex(b);
}

/** RFC 9562 UUID version 7: 48-bit Unix ms timestamp + random bits. */
export function uuidV7(now = Date.now()): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  let ts = now;
  for (let i = 5; i >= 0; i--) {
    b[i] = ts % 256;
    ts = Math.floor(ts / 256);
  }
  b[6] = (b[6] & 0x0f) | 0x70;
  b[8] = (b[8] & 0x3f) | 0x80;
  return hex(b);
}
