import { categories, plannedTools, tools } from "./registry";
import type { CategoryId, PlannedTool, Tool } from "./registry";

/**
 * Internal tool search.
 *
 * Every tool is indexed by name, keywords, synonyms, category and copy, with
 * field weights. Query terms match exactly, by prefix (as you type) or with a
 * small edit distance (typos). Query-side synonyms ("ig" → instagram, "shrink"
 * → compress) widen recall without bloating the registry.
 */

const STOP_WORDS = new Set(["free", "online", "tool", "tools", "best", "the", "a", "an", "my", "for", "app", "website", "site", "easy", "fast", "to", "of", "and", "with", "in", "how", "do", "i"]);

const QUERY_SYNONYMS: Record<string, string[]> = {
  ig: ["instagram"],
  insta: ["instagram"],
  gram: ["instagram"],
  yt: ["youtube"],
  fb: ["facebook"],
  tt: ["tiktok"],
  twitter: ["x", "twitter"],
  tweet: ["twitter"],
  pic: ["image", "photo"],
  pics: ["image", "photo"],
  picture: ["image", "photo"],
  photo: ["image", "photo"],
  photos: ["image", "photo"],
  img: ["image"],
  images: ["image"],
  jpeg: ["jpg"],
  shrink: ["compress", "compressor"],
  reduce: ["compress", "reduce"],
  smaller: ["compress"],
  optimise: ["compress", "optimizer"],
  optimize: ["compress", "optimizer"],
  beautify: ["format", "formatter", "beautify"],
  beautifier: ["formatter", "beautifier"],
  prettify: ["format", "formatter"],
  pretty: ["format", "formatter"],
  lint: ["validator", "validate"],
  pwd: ["password"],
  pass: ["password"],
  passcode: ["password"],
  maker: ["generator", "maker"],
  creator: ["generator", "creator"],
  create: ["generator", "create"],
  make: ["generator"],
  generate: ["generator"],
  calc: ["calculator"],
  calculate: ["calculator", "calculate"],
  convert: ["converter", "convert"],
  save: ["downloader", "save"],
  download: ["downloader", "download"],
  grab: ["downloader"],
  mp4: ["video", "downloader"],
  clip: ["video"],
  reel: ["reels"],
  short: ["shorts"],
  count: ["counter", "count"],
  wireless: ["wifi"],
  "wi": ["wifi"],
  vcard: ["contact", "vcard"],
  checksum: ["hash", "checksum"],
  sha: ["hash", "sha256"],
  diff: ["compare", "diff"],
  mortgage: ["loan", "mortgage"],
  emi: ["loan", "emi"],
  guid: ["uuid", "guid"],
};

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/wi-fi/g, "wifi")
    .replace(/robots\.txt/g, "robots txt")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function tokenize(s: string): string[] {
  return normalize(s).split(" ").filter(Boolean);
}

/** Optimal string alignment distance (Damerau–Levenshtein with adjacent transpositions), capped. */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev2 = new Array(b.length + 1).fill(0);
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    for (let j = 0; j <= b.length; j++) prev2[j] = prev[j];
    prev = cur;
  }
  return prev[b.length];
}

const allowedTypos = (len: number) => (len >= 8 ? 2 : len >= 4 ? 1 : 0);

interface Field {
  weight: number;
  tokens: string[];
  phrases: string[];
}

interface IndexedTool {
  tool: Tool;
  fields: Field[];
}

function field(weight: number, texts: string[]): Field {
  return { weight, tokens: [...new Set(texts.flatMap(tokenize))], phrases: texts.map(normalize) };
}

const index: IndexedTool[] = tools.map((tool) => {
  const cat = categories.find((c) => c.id === tool.category)!;
  return {
    tool,
    fields: [
      field(10, [tool.name, tool.slug.replace(/-/g, " ")]),
      field(7, tool.keywords),
      field(6, tool.synonyms),
      field(3, [cat.name]),
      field(2, [tool.tagline]),
      field(1, [tool.seo.description]),
    ],
  };
});

/** Quality of the best match of `term` within `tokens`: 1 exact, 0.85 prefix, 0.6 typo. */
function termQuality(term: string, tokens: string[], allowPrefix: boolean): number {
  let best = 0;
  const typos = allowedTypos(term.length);
  for (const tok of tokens) {
    if (tok === term) return 1;
    if (tok === term + "s" || term === tok + "s") best = Math.max(best, 0.95);
    if (allowPrefix && term.length >= 2 && tok.startsWith(term)) best = Math.max(best, 0.85);
    else if (term.length >= 4 && tok.length > term.length && tok.startsWith(term)) best = Math.max(best, 0.75);
    else if (typos && Math.abs(tok.length - term.length) <= typos && editDistance(term, tok, typos) <= typos) best = Math.max(best, 0.6);
  }
  return best;
}

export interface SearchOptions {
  category?: CategoryId;
  limit?: number;
}

export interface SearchResult {
  tool: Tool;
  score: number;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  /** True when not every query term matched; results are the closest partial matches. */
  partial: boolean;
  /** Planned (not yet built) tools that match the query. */
  planned: PlannedTool[];
}

function queryTerms(query: string): string[][] {
  const raw = tokenize(query);
  const meaningful = raw.filter((t) => !STOP_WORDS.has(t));
  const terms = meaningful.length ? meaningful : raw;
  return terms.map((t) => [...new Set([t, ...(QUERY_SYNONYMS[t] ?? [])])]);
}

export function searchTools(query: string, opts: SearchOptions = {}): SearchResponse {
  const { category, limit = 20 } = opts;
  const terms = queryTerms(query);
  const nq = normalize(query);
  const pool = category ? index.filter((i) => i.tool.category === category) : index;

  if (!terms.length) {
    return { query, results: pool.slice(0, limit).map((i) => ({ tool: i.tool, score: 0 })), partial: false, planned: [] };
  }

  const scored = pool.map(({ tool, fields }) => {
    let score = 0;
    let matched = 0;
    terms.forEach((alts, idx) => {
      const isLast = idx === terms.length - 1;
      // Best field counts fully; other matching fields add a little, so a
      // tool that matches in several places beats a single weak match.
      const perField = fields.map((f) => {
        let q = 0;
        for (const alt of alts) q = Math.max(q, termQuality(alt, f.tokens, isLast) * (alt === alts[0] ? 1 : 0.9));
        return q * f.weight;
      });
      const best = Math.max(...perField);
      if (best > 0) matched++;
      score += best + 0.3 * (perField.reduce((a, b) => a + b, 0) - best);
    });
    // Whole-phrase bonus: the query appears inside the name or a keyword phrase.
    if (nq.length >= 3) {
      if (fields[0].phrases.some((p) => p === nq) || fields[1].phrases.some((p) => p === nq)) score += 20;
      if (fields[0].phrases.some((p) => p.includes(nq))) score += 12;
      else if (fields[1].phrases.some((p) => p.includes(nq)) || fields[2].phrases.some((p) => p.includes(nq))) score += 8;
    }
    // Category intent: "calculators", "image tools", "qr codes".
    if (fields[3].phrases.some((p) => p === nq || p === nq + "s" || p.replace(/ tools$/, "") === nq)) score += 6;
    // Prefer working tools slightly when scores tie.
    if (tool.status === "live") score += 0.01;
    return { tool, score, matched };
  });

  const full = scored.filter((s) => s.matched === terms.length && s.score > 0);
  const planned = matchPlanned(terms, nq);

  // No tool matched every term: fall back to the closest partial matches,
  // flagged so the UI presents them as "related" rather than as the answer
  // (e.g. "pdf compressor" → planned PDF Compressor + related Image Compressor).
  let results = full;
  let partial = false;
  if (!results.length && terms.length > 1) {
    const threshold = Math.ceil(terms.length / 2);
    results = scored.filter((s) => s.matched >= threshold && s.score > 0);
    partial = results.length > 0;
  }

  results.sort((a, b) => b.score - a.score || a.tool.name.localeCompare(b.tool.name));
  return {
    query,
    results: results.slice(0, limit).map(({ tool, score }) => ({ tool, score })),
    partial,
    planned,
  };
}

function matchPlanned(terms: string[][], nq: string): PlannedTool[] {
  return plannedTools.filter((p) => {
    const tokens = [...new Set([p.name, ...p.keywords].flatMap(tokenize))];
    if ([p.name, ...p.keywords].some((k) => normalize(k) === nq)) return true;
    return terms.every((alts) => alts.some((a) => termQuality(a, tokens, true) >= 0.6));
  });
}

export const popularSearches = [
  "Instagram downloader",
  "QR code generator",
  "Image compressor",
  "JSON formatter",
  "Password generator",
  "YouTube downloader",
];
