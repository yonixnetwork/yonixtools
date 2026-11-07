// Local, privacy-conscious download history: platform, title, format and time only.
// Source URLs and files are never stored. Every storage access is guarded.
export interface HistoryEntry {
  platform: string;
  title: string;
  format: string;
  at: number;
}

const KEY = "ytx-history";
const PREF = "ytx-pref-format";
const MAX = 20;

export function readHistory(): HistoryEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v.filter((e) => e && typeof e.title === "string" && typeof e.at === "number").slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function addHistory(e: HistoryEntry): HistoryEntry[] {
  const next = [{ ...e, title: e.title.slice(0, 140) }, ...readHistory()].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
  return next;
}

export function clearHistory() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Remember the kind of quality last chosen ("v:720", "a:best", …) to highlight it next time. */
export function readPreferredFormat(): string | null {
  try {
    return localStorage.getItem(PREF);
  } catch {
    return null;
  }
}

export function savePreferredFormat(id: string) {
  try {
    if (/^(v:(best|\d{3,4})|a:best|i:best|f:best)$/.test(id)) localStorage.setItem(PREF, id);
  } catch {
    /* ignore */
  }
}
