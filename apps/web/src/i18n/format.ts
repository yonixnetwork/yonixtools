/**
 * Message formatting shared by server and client code. No library: the standard Intl APIs do the
 * locale work (plural rules, numbers, dates), which keeps the static export free of a runtime server.
 *
 * Message syntax:
 *  - plain string with {name} placeholders:            "Merged {count} files"
 *  - plural object keyed by CLDR category ("other" required):
 *      { "one": "{count} file", "other": "{count} files" }   (selected by Intl.PluralRules on `count`)
 *  - rich tags for markup, rendered by tRich():        "Read the <link>guide</link>"
 * Numbers passed as placeholder values are formatted for the locale.
 */
export type Message = string | Partial<Record<Intl.LDMLPluralRule, string>>;
export type Messages = Record<string, Message>;
export type Vars = Record<string, string | number>;

export const PLURAL_CATEGORIES: Intl.LDMLPluralRule[] = ["zero", "one", "two", "few", "many", "other"];

export const isPlural = (m: Message | undefined): m is Partial<Record<Intl.LDMLPluralRule, string>> => !!m && typeof m === "object" && "other" in m;

const pluralCache = new Map<string, Intl.PluralRules>();
export function pluralRules(locale: string): Intl.PluralRules {
  let r = pluralCache.get(locale);
  if (!r) pluralCache.set(locale, (r = new Intl.PluralRules(locale)));
  return r;
}
/** The plural categories a locale needs (e.g. en: one/other, ar: zero/one/two/few/many/other). */
export const requiredPluralCategories = (locale: string) => pluralRules(locale).resolvedOptions().pluralCategories as Intl.LDMLPluralRule[];

const numCache = new Map<string, Intl.NumberFormat>();
export function formatNumber(locale: string, n: number, opts?: Intl.NumberFormatOptions): string {
  if (!Number.isFinite(n)) return "—";
  const k = `${locale}|${opts ? JSON.stringify(opts) : ""}`;
  let f = numCache.get(k);
  if (!f) numCache.set(k, (f = new Intl.NumberFormat(locale, opts)));
  return f.format(n);
}

export function formatDate(locale: string, d: Date | string | number, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }): string {
  const date = typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T00:00:00Z`) : new Date(d);
  return new Intl.DateTimeFormat(locale, opts).format(date);
}

/** File sizes with locale digits and units (KB/MB/GB via Intl unit formatting). */
export function formatBytes(locale: string, bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  const units = ["byte", "kilobyte", "megabyte", "gigabyte"] as const;
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return formatNumber(locale, v, { style: "unit", unit: units[i], unitDisplay: i === 0 ? "long" : "short", maximumFractionDigits: i === 0 ? 0 : v < 10 ? 1 : 0 });
}

export function formatCurrency(locale: string, n: number, currency = "USD", opts: Intl.NumberFormatOptions = {}): string {
  return formatNumber(locale, n, { style: "currency", currency, ...opts });
}

/** The placeholder names used in a message ({name}), for validation. */
export function placeholders(m: Message): string[] {
  const texts = typeof m === "string" ? [m] : Object.values(m).filter((v): v is string => typeof v === "string");
  const out = new Set<string>();
  for (const t of texts) for (const x of t.matchAll(/\{([a-zA-Z0-9_]+)\}/g)) out.add(x[1]);
  return [...out].sort();
}
/** The rich-tag names used in a message (<link>…</link>), for validation. */
export function tags(m: Message): string[] {
  const texts = typeof m === "string" ? [m] : Object.values(m).filter((v): v is string => typeof v === "string");
  const out = new Set<string>();
  for (const t of texts) for (const x of t.matchAll(/<([a-zA-Z][a-zA-Z0-9]*)>/g)) out.add(x[1]);
  return [...out].sort();
}

export function interpolate(locale: string, text: string, vars?: Vars): string {
  if (!vars) return text;
  return text.replace(/\{([a-zA-Z0-9_]+)\}/g, (all, k: string) => {
    const v = vars[k];
    if (v === undefined) return all;
    return typeof v === "number" ? formatNumber(locale, v) : v;
  });
}

/** Resolve a message (plural selection + placeholders) to text. */
export function render(locale: string, m: Message, vars?: Vars): string {
  if (typeof m === "string") return interpolate(locale, m, vars);
  const count = typeof vars?.count === "number" ? vars.count : Number(vars?.count ?? 0);
  const cat = pluralRules(locale).select(count);
  const text = m[cat] ?? m.other ?? "";
  return interpolate(locale, text, vars);
}

/** Visible marker for a missing key. Never English: a missing translation must be noticed, not hidden. */
export const missingMarker = (ns: string, key: string) => `⟦${ns}:${key}⟧`;
