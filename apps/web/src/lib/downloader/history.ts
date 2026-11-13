// The only thing remembered between visits: the kind of quality last chosen
// ("v:720", "a:best", …), to highlight it next time. No links, titles or
// download history are stored. Every storage access is guarded.
const PREF = "ytx-pref-format";
const LEGACY_HISTORY = "ytx-history"; // removed feature: cleared on read

export function readPreferredFormat(): string | null {
  try {
    localStorage.removeItem(LEGACY_HISTORY);
    return localStorage.getItem(PREF);
  } catch {
    return null;
  }
}

export function savePreferredFormat(id: string) {
  try {
    if (/^(v:(best|\d{3,4})|a:(best|mp3)|i:best|f:best)$/.test(id)) localStorage.setItem(PREF, id);
  } catch {
    /* ignore */
  }
}
