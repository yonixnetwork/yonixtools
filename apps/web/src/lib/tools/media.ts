// Pure helpers for the Video tools and Other utilities categories (unit-tested).
import { randomInt } from "./random";

/** Encode PCM channels as a 16-bit little-endian WAV file. */
export function encodeWav(channels: Float32Array[], sampleRate: number): ArrayBuffer {
  const n = channels.length;
  if (!n) throw new Error("no audio channels");
  const frames = channels[0].length;
  const dataSize = frames * n * 2;
  const buf = new ArrayBuffer(44 + dataSize);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + dataSize, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true); // PCM chunk size
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, n, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * n * 2, true);
  v.setUint16(32, n * 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, dataSize, true);
  let o = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < n; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      o += 2;
    }
  }
  return buf;
}

/** 3725.5 → "1:02:05.500"; 65 → "1:05.000" (stopwatch style when ms=true). */
export function formatClock(seconds: number, ms = false): string {
  const total = Math.max(0, seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  const frac = ms ? `.${String(Math.floor((total % 1) * 1000)).padStart(3, "0")}` : "";
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}${frac}` : `${m}:${String(s).padStart(2, "0")}${frac}`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  const units = ["B", "kB", "MB", "GB"];
  let v = bytes, i = 0;
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000;
    i++;
  }
  return `${i ? v.toFixed(1) : v} ${units[i]}`;
}

export function aspectRatio(w: number, h: number): string {
  if (!w || !h) return "—";
  const g = (a: number, b: number): number => (b ? g(b, a % b) : a);
  const d = g(w, h);
  return `${w / d}:${h / d}`;
}

/** Cryptographically random integers in [min, max], optionally without repeats. */
export function randomIntegers(min: number, max: number, count: number, unique: boolean, rand: (n: number) => number = randomInt): number[] {
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max) throw new RangeError("Enter whole numbers with the minimum not above the maximum.");
  const span = max - min + 1;
  if (span > 2 ** 32) throw new RangeError("The range is too large (maximum 4,294,967,296 values).");
  if (!Number.isInteger(count) || count < 1 || count > 10000) throw new RangeError("Choose between 1 and 10,000 numbers.");
  if (unique && count > span) throw new RangeError(`Only ${span} different numbers exist in that range.`);
  if (!unique) return Array.from({ length: count }, () => min + rand(span));
  // Partial Fisher-Yates over a sparse map: exact, and fine for huge ranges.
  const swaps = new Map<number, number>();
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const j = i + rand(span - i);
    const vj = swaps.get(j) ?? j;
    swaps.set(j, swaps.get(i) ?? i);
    out.push(min + vj);
  }
  return out;
}
