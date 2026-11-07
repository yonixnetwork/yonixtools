// Pure conversion helpers for the Converters category (unit-tested).

// ── Colours ─────────────────────────────────────────────────────────────────
export interface Rgba {
  r: number; // 0-255
  g: number;
  b: number;
  a: number; // 0-1
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function channel(s: string, max: number): number {
  const t = s.trim();
  const v = t.endsWith("%") ? (parseFloat(t) / 100) * max : parseFloat(t);
  if (!Number.isFinite(v)) throw new Error("bad channel");
  return clamp(v, 0, max);
}

/** Parse #rgb, #rgba, #rrggbb, #rrggbbaa, rgb()/rgba() and hsl()/hsla(). Returns null when invalid. */
export function parseColor(input: string): Rgba | null {
  const s = input.trim().toLowerCase();
  const hex = s.match(/^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/);
  if (hex) {
    let h = hex[1];
    if (h.length <= 4) h = h.split("").map((c) => c + c).join("");
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? Math.round((n(6) / 255) * 1000) / 1000 : 1 };
  }
  const fn = s.match(/^(rgba?|hsla?)\(\s*([^)]+)\)$/);
  if (!fn) return null;
  const parts = fn[2].split(/\s*[,/]\s*|\s+/).filter(Boolean);
  if (parts.length < 3 || parts.length > 4) return null;
  try {
    const a = parts[3] !== undefined ? channel(parts[3], 1) : 1;
    if (fn[1].startsWith("rgb")) {
      return { r: Math.round(channel(parts[0], 255)), g: Math.round(channel(parts[1], 255)), b: Math.round(channel(parts[2], 255)), a };
    }
    const h = ((parseFloat(parts[0]) % 360) + 360) % 360;
    const sat = channel(parts[1].endsWith("%") ? parts[1] : `${parts[1]}%`, 1);
    const l = channel(parts[2].endsWith("%") ? parts[2] : `${parts[2]}%`, 1);
    if (!Number.isFinite(h)) return null;
    return { ...hslToRgb(h, sat, l), a };
  } catch {
    return null;
  }
}

export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
}

export function rgbToHsl({ r, g, b }: { r: number; g: number; b: number }): { h: number; s: number; l: number } {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255];
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === rr ? (gg - bb) / d + (gg < bb ? 6 : 0) : max === gg ? (bb - rr) / d + 2 : (rr - gg) / d + 4;
  return { h: Math.round(h * 60) % 360, s: Math.round(s * 100), l: Math.round(l * 100) };
}

const hx = (v: number) => Math.round(v).toString(16).padStart(2, "0");

export function formatColor(c: Rgba) {
  const { h, s, l } = rgbToHsl(c);
  const alpha = c.a < 1;
  return {
    hex: `#${hx(c.r)}${hx(c.g)}${hx(c.b)}${alpha ? hx(c.a * 255) : ""}`.toUpperCase(),
    rgb: alpha ? `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a})` : `rgb(${c.r}, ${c.g}, ${c.b})`,
    hsl: alpha ? `hsla(${h}, ${s}%, ${l}%, ${c.a})` : `hsl(${h}, ${s}%, ${l}%)`,
  };
}

/** WCAG relative luminance and contrast ratio against white and black. */
export function contrast(c: Rgba): { white: number; black: number } {
  const lin = (v: number) => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  const round = (v: number) => Math.round(v * 100) / 100;
  return { white: round(1.05 / (L + 0.05)), black: round((L + 0.05) / 0.05) };
}

// ── Unix timestamps ──────────────────────────────────────────────────────────
/** Seconds (up to 11 digits) or milliseconds, or any date string Date can parse. */
export function parseTimestamp(input: string): { date: Date; unit: "seconds" | "milliseconds" | "date" } | null {
  const s = input.trim();
  if (!s) return null;
  if (/^-?\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    const digits = s.replace(/^-/, "").split(".")[0].length;
    const ms = digits <= 11 ? n * 1000 : n;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : { date: d, unit: digits <= 11 ? "seconds" : "milliseconds" };
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : { date: d, unit: "date" };
}

export function relativeTime(d: Date, now = Date.now()): string {
  const diff = Math.round((d.getTime() - now) / 1000);
  const abs = Math.abs(diff);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [["year", 31536000], ["month", 2592000], ["day", 86400], ["hour", 3600], ["minute", 60], ["second", 1]];
  const [unit, size] = units.find(([, sz]) => abs >= sz) ?? ["second", 1];
  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(Math.round(diff / size), unit);
}

// ── Number bases ─────────────────────────────────────────────────────────────
const DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";

/** Convert an integer between bases 2-36 (arbitrary size, optional leading minus). Returns null when invalid. */
export function convertBase(value: string, from: number, to: number): string | null {
  const v = value.trim().toLowerCase().replace(/[\s_]/g, "").replace(/^(-?)0[xbo](?=.)/, "$1");
  if (!v || from < 2 || from > 36 || to < 2 || to > 36) return null;
  const neg = v.startsWith("-");
  const body = neg ? v.slice(1) : v;
  if (!body) return null;
  let n = 0n;
  const big = BigInt(from);
  for (const ch of body) {
    const d = DIGITS.indexOf(ch);
    if (d < 0 || d >= from) return null;
    n = n * big + BigInt(d);
  }
  if (n === 0n) return "0";
  let out = "";
  const bt = BigInt(to);
  while (n > 0n) {
    out = DIGITS[Number(n % bt)] + out;
    n /= bt;
  }
  return (neg ? "-" : "") + out.toUpperCase();
}

// ── Time zones ───────────────────────────────────────────────────────────────
/** Offset of `zone` from UTC at `instant`, in minutes (e.g. +60 for Europe/Paris in winter). */
export function zoneOffsetMinutes(instant: Date, zone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60000);
}

/** The instant at which the wall-clock time `local` ("YYYY-MM-DDTHH:mm") happens in `zone`. */
export function wallTimeToInstant(local: string, zone: string): Date | null {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  if (Number.isNaN(guess)) return null;
  let t = guess - zoneOffsetMinutes(new Date(guess), zone) * 60000;
  t = guess - zoneOffsetMinutes(new Date(t), zone) * 60000; // second pass settles DST edges
  return new Date(t);
}

export function formatInZone(instant: Date, zone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: zone, weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(instant);
}

export function offsetLabel(minutes: number): string {
  const sign = minutes >= 0 ? "+" : "−";
  const a = Math.abs(minutes);
  return `UTC${sign}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`;
}

export const COMMON_ZONES = [
  "UTC", "America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York", "America/Sao_Paulo", "Europe/London", "Europe/Paris",
  "Europe/Berlin", "Europe/Madrid", "Africa/Lagos", "Africa/Nairobi", "Africa/Johannesburg", "Europe/Istanbul", "Asia/Dubai", "Asia/Karachi", "Asia/Kolkata",
  "Asia/Dhaka", "Asia/Bangkok", "Asia/Jakarta", "Asia/Manila", "Asia/Singapore", "Asia/Shanghai", "Asia/Tokyo", "Asia/Seoul", "Australia/Sydney", "Pacific/Auckland",
];
