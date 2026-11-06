// Per-visitor "recently used tools", kept only in this browser. Every access is
// guarded: storage can be unavailable (private mode, blocked site data).
const KEY = "yt-recent";
const MAX = 8;

export function getRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string").slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function recordVisit(slug: string) {
  try {
    const next = [slug, ...getRecent().filter((s) => s !== slug)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
