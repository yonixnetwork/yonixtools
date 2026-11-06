// ── Counting ────────────────────────────────────────────────────────────────

const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;
const wordSegmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "word" }) : null;

export function countGraphemes(s: string): number {
  if (!s) return 0;
  if (segmenter) {
    let n = 0;
    for (const _ of segmenter.segment(s)) n++;
    return n;
  }
  return Array.from(s).length;
}

export function countWords(s: string): number {
  if (!s.trim()) return 0;
  if (wordSegmenter) {
    let n = 0;
    for (const seg of wordSegmenter.segment(s)) if (seg.isWordLike) n++;
    return n;
  }
  return s.trim().split(/\s+/).length;
}

export interface TextStats {
  words: number;
  characters: number;
  charactersNoSpaces: number;
  sentences: number;
  paragraphs: number;
  lines: number;
  readingMinutes: number;
  speakingMinutes: number;
}

export function textStats(s: string): TextStats {
  const words = countWords(s);
  const trimmed = s.trim();
  return {
    words,
    characters: countGraphemes(s),
    charactersNoSpaces: countGraphemes(s.replace(/\s+/g, "")),
    sentences: trimmed ? (trimmed.match(/[^.!?…]+([.!?…]+|$)/g) || []).filter((x) => /\p{L}|\p{N}/u.test(x)).length : 0,
    paragraphs: trimmed ? trimmed.split(/\n\s*\n/).filter((p) => p.trim()).length : 0,
    lines: s ? s.split("\n").length : 0,
    readingMinutes: words / 238,
    speakingMinutes: words / 150,
  };
}

const KEYWORD_STOP = new Set("a an and are as at be but by for from has have he her his i if in into is it its me my no not of on or our she so than that the their them then there these they this to was we were what when which who will with you your".split(" "));

export function topKeywords(s: string, limit = 8): Array<{ word: string; count: number; percent: number }> {
  const words = (s.toLowerCase().match(/[\p{L}\p{N}']+/gu) || []).filter((w) => w.length > 2 && !KEYWORD_STOP.has(w));
  const counts = new Map<string, number>();
  words.forEach((w) => counts.set(w, (counts.get(w) || 0) + 1));
  const total = countWords(s) || 1;
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word, count]) => ({ word, count, percent: (count / total) * 100 }));
}

// ── Case conversion ─────────────────────────────────────────────────────────

export type CaseStyle = "upper" | "lower" | "title" | "sentence" | "camel" | "pascal" | "snake" | "kebab" | "constant";

const SMALL_WORDS = new Set("a an and as at but by en for if in nor of on or per the to via vs".split(" "));

/** Split into words for programming cases: handles spaces, punctuation, camelCase and acronyms. */
export function splitWords(s: string): string[] {
  return s
    .replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, "$1 $2")
    .replace(/(\p{Lu}+)(\p{Lu}\p{Ll})/gu, "$1 $2")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();

export function convertCase(s: string, style: CaseStyle): string {
  switch (style) {
    case "upper":
      return s.toUpperCase();
    case "lower":
      return s.toLowerCase();
    case "sentence":
      return s.toLowerCase().replace(/(^\s*\p{L}|[.!?]\s+\p{L})/gu, (m) => m.toUpperCase());
    case "title":
      return s
        .split("\n")
        .map((line) => {
          const parts = line.split(/(\s+)/);
          const wordIdx = parts.map((p, i) => (p.trim() ? i : -1)).filter((i) => i >= 0);
          const first = wordIdx[0];
          const last = wordIdx[wordIdx.length - 1];
          return parts
            .map((p, i) => {
              if (!p.trim()) return p;
              const lower = p.toLowerCase();
              if (i !== first && i !== last && SMALL_WORDS.has(lower)) return lower;
              return lower.replace(/^(\P{L}*)(\p{L})/u, (_, pre, ch) => pre + ch.toUpperCase()).replace(/-(\p{L})/gu, (_, ch) => "-" + ch.toUpperCase());
            })
            .join("");
        })
        .join("\n");
    case "camel": {
      const w = splitWords(s);
      return w.map((x, i) => (i === 0 ? x.toLowerCase() : cap(x))).join("");
    }
    case "pascal":
      return splitWords(s).map(cap).join("");
    case "snake":
      return splitWords(s).map((x) => x.toLowerCase()).join("_");
    case "kebab":
      return splitWords(s).map((x) => x.toLowerCase()).join("-");
    case "constant":
      return splitWords(s).map((x) => x.toUpperCase()).join("_");
  }
}

// ── Slugs ───────────────────────────────────────────────────────────────────

const SLUG_STOP = new Set("a an and are as at be by for from in is it of on or the to with".split(" "));
const TRANSLIT: Record<string, string> = { ß: "ss", æ: "ae", œ: "oe", ø: "o", đ: "d", ł: "l", þ: "th", ð: "d", "&": " and " };

export interface SlugOptions {
  separator?: "-" | "_";
  removeStopWords?: boolean;
  maxLength?: number;
}

export function slugify(input: string, opts: SlugOptions = {}): string {
  const sep = opts.separator ?? "-";
  let s = input.toLowerCase().replace(/[ßæœøđłþð&]/g, (c) => TRANSLIT[c] ?? c);
  s = s.normalize("NFKD").replace(/[̀-ͯ]/g, "");
  let words = s.split(/[^a-z0-9]+/).filter(Boolean);
  if (opts.removeStopWords) {
    const kept = words.filter((w) => !SLUG_STOP.has(w));
    if (kept.length) words = kept;
  }
  let out = words.join(sep);
  if (opts.maxLength && out.length > opts.maxLength) {
    out = out.slice(0, opts.maxLength);
    const cut = out.lastIndexOf(sep);
    if (cut > 0) out = out.slice(0, cut);
  }
  return out;
}

// ── Lorem ipsum ─────────────────────────────────────────────────────────────

const LOREM_WORDS =
  "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum curabitur pretium tincidunt lacus nulla gravida orci a odio nullam varius turpis et commodo pharetra est eros bibendum elit nec luctus magna felis sollicitudin mauris integer in mauris eu nibh euismod gravida duis ac tellus et risus vulputate vehicula donec lobortis risus a elit etiam tempor ut ullamcorper ligula eu tempor congue eros est euismod turpis id tincidunt sapien risus a quam maecenas fermentum consequat mi donec fermentum pellentesque malesuada nulla a mi duis sapien sem aliquet nec commodo eget consequat quis neque aliquam faucibus".split(
    " ",
  );
const CLASSIC = "Lorem ipsum dolor sit amet, consectetur adipiscing elit";

/** Small deterministic PRNG so output is stable for a given seed (and testable). */
export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface LoremOptions {
  unit: "paragraphs" | "sentences" | "words";
  count: number;
  startClassic: boolean;
  seed?: number;
}

export function lorem(opts: LoremOptions): string[] {
  const rand = mulberry32(opts.seed ?? Date.now());
  const pick = () => LOREM_WORDS[Math.floor(rand() * LOREM_WORDS.length)];
  const sentence = () => {
    const n = 6 + Math.floor(rand() * 10);
    const w = Array.from({ length: n }, pick);
    if (n > 9 && rand() > 0.5) w[Math.floor(n / 2)] += ",";
    const s = w.join(" ");
    return s.charAt(0).toUpperCase() + s.slice(1) + ".";
  };
  const count = Math.max(1, Math.min(opts.unit === "words" ? 5000 : 200, Math.floor(opts.count)));
  if (opts.unit === "words") {
    const words = Array.from({ length: count }, pick);
    if (opts.startClassic) CLASSIC.replace(",", "").toLowerCase().split(" ").slice(0, count).forEach((w, i) => (words[i] = w));
    const s = words.join(" ");
    return [s.charAt(0).toUpperCase() + s.slice(1) + "."];
  }
  if (opts.unit === "sentences") {
    const out = Array.from({ length: count }, sentence);
    if (opts.startClassic) out[0] = CLASSIC + ".";
    return [out.join(" ")];
  }
  const paras = Array.from({ length: count }, () => Array.from({ length: 4 + Math.floor(rand() * 4) }, sentence).join(" "));
  if (opts.startClassic) paras[0] = `${CLASSIC}. ${paras[0]}`;
  return paras;
}

// ── Diff ────────────────────────────────────────────────────────────────────

export type DiffLine = { type: "same" | "add" | "del"; text: string; a?: number; b?: number };

export const DIFF_MAX_CELLS = 25_000_000;

export function diffLines(aText: string, bText: string, opts: { ignoreWhitespace?: boolean; ignoreCase?: boolean } = {}): DiffLine[] | null {
  const a = aText.split("\n");
  const b = bText.split("\n");
  const key = (s: string) => {
    let k = opts.ignoreWhitespace ? s.trim().replace(/\s+/g, " ") : s;
    if (opts.ignoreCase) k = k.toLowerCase();
    return k;
  };
  // Trim common prefix/suffix first: most real diffs are small edits.
  let start = 0;
  while (start < a.length && start < b.length && key(a[start]) === key(b[start])) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && key(a[endA - 1]) === key(b[endB - 1])) {
    endA--;
    endB--;
  }
  const n = endA - start;
  const m = endB - start;
  if (n * m > DIFF_MAX_CELLS) return null;

  const ka = a.slice(start, endA).map(key);
  const kb = b.slice(start, endB).map(key);
  // LCS table over the differing middle section (Uint32 rows).
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = ka[i] === kb[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);

  const out: DiffLine[] = [];
  for (let i = 0; i < start; i++) out.push({ type: "same", text: b[i], a: i + 1, b: i + 1 });
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && ka[i] === kb[j]) {
      out.push({ type: "same", text: b[start + j], a: start + i + 1, b: start + j + 1 });
      i++;
      j++;
    } else if (j < m && (i >= n || dp[i][j + 1] >= dp[i + 1][j])) {
      out.push({ type: "add", text: b[start + j], b: start + j + 1 });
      j++;
    } else {
      out.push({ type: "del", text: a[start + i], a: start + i + 1 });
      i++;
    }
  }
  for (let k = 0; k < a.length - endA; k++) out.push({ type: "same", text: b[endB + k], a: endA + k + 1, b: endB + k + 1 });
  return out;
}
