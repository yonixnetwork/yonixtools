/**
 * Catalogue quality and status: completeness, validity, translation provenance, human review and
 * per-page indexing eligibility. Used by the build (which locales exist, which pages are indexable),
 * the CI check (npm run i18n:check) and the coverage report (npm run i18n:report).
 *
 * Status of one key in one locale:
 *   missing      – no translation
 *   invalid      – placeholders, rich tags or plural forms don't match what the locale needs
 *   untranslated – identical to English (and not a brand/technical term or an intentional copy)
 *   machine      – machine-translated (incl. AI), not reviewed by a person
 *   unreviewed   – human-translated, but no review record yet
 *   reviewed     – a named reviewer approved exactly this source text and this translation
 *   stale        – reviewed once, but the English or the translation changed since
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { isPlural, placeholders, requiredPluralCategories, tags, type Message, type Messages } from "./format";
import { NAMESPACE_IDS } from "./namespaces";
import { GLOSSARY, PUBLISHED_LOCALES } from "./config";
import { getLocale, isKnownLocale } from "./locales";
import { loadNamespace } from "./server";

export type KeyState = "missing" | "invalid" | "untranslated" | "machine" | "unreviewed" | "reviewed" | "stale";

export interface ReviewEntry {
  by: string;
  date: string;
  /** Hash of the English source text that was reviewed. */
  src: string;
  /** Hash of the translation that was approved. */
  val: string;
}

export interface LocaleStatusFile {
  /** How the catalogue was produced: "machine" (machine translation, incl. AI) or "human". */
  method: "machine" | "human" | "none";
  translator: string;
  translatedAt: string | null;
  /** ns:key entries that are intentionally identical to English (e.g. product names). */
  intentionalSame: string[];
  reviews: Record<string, ReviewEntry>;
}

export const STATUS_DIR = path.join(process.cwd(), "src", "i18n", "status");
const reportCache = new Map<string, LocaleReport>();
const EMPTY_STATUS: LocaleStatusFile = { method: "none", translator: "", translatedAt: null, intentionalSame: [], reviews: {} };

/** Tests only: an in-memory status for a locale (never written to disk). */
const statusOverrides = new Map<string, LocaleStatusFile>();
export function __setStatusForTest(locale: string, status: LocaleStatusFile | undefined) {
  if (status) statusOverrides.set(locale, status);
  else statusOverrides.delete(locale);
  reportCache.clear();
}

export function readStatusFile(locale: string): LocaleStatusFile {
  const o = statusOverrides.get(locale);
  if (o) return o;
  const f = path.join(STATUS_DIR, `${locale}.json`);
  if (!fs.existsSync(f)) return EMPTY_STATUS;
  return { ...EMPTY_STATUS, ...(JSON.parse(fs.readFileSync(f, "utf8")) as Partial<LocaleStatusFile>) };
}

export const hashMessage = (m: Message | undefined) => crypto.createHash("sha256").update(JSON.stringify(m ?? null)).digest("hex").slice(0, 16);

/** Keys whose value may legitimately equal English: URL slugs and URL segments. */
const SLUG_KEY = /(^|\.)slug$|^route\./;
export const isSlugKey = (key: string) => SLUG_KEY.test(key);
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const glossaryRe = new RegExp(`(${GLOSSARY.map((g) => g.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
/** True if an English text has real words to translate once brands, formats, numbers and placeholders are removed. */
export function hasTranslatableWords(text: string): boolean {
  const stripped = text
    .replace(/\{[a-zA-Z0-9_]+\}/g, " ")
    .replace(/<\/?[a-zA-Z0-9]+>/g, " ")
    .replace(/\[[^\]]*\]\([^)]*\)/g, (m) => m.replace(/\([^)]*\)/, ""))
    .replace(glossaryRe, " ")
    .replace(/https?:\/\/\S+/g, " ");
  return (stripped.match(/[A-Za-z]{3,}/g) ?? []).length > 0;
}

function textsOf(m: Message): string[] {
  return typeof m === "string" ? [m] : Object.values(m).filter((v): v is string => typeof v === "string");
}

/** Problems with one translated message compared with its English source. Empty = valid. */
export function validateMessage(locale: string, key: string, source: Message, value: Message): string[] {
  const out: string[] = [];
  if (textsOf(value).some((t) => t.trim() === "")) out.push("empty text");
  const ph = (m: Message) => placeholders(m).filter((p) => p !== "count");
  const a = ph(source).join(","), b = ph(value).join(",");
  if (a !== b) out.push(`placeholders differ: en {${a}} vs {${b}}`);
  if (tags(source).join(",") !== tags(value).join(",")) out.push(`rich tags differ: en <${tags(source).join(",")}> vs <${tags(value).join(",")}>`);
  // Link markup used in guides: [text](/path/) must keep the same targets in the same order.
  const links = (m: Message) => textsOf(m).flatMap((t) => [...t.matchAll(/\]\((\/[^)\s]*)\)/g)].map((x) => x[1])).join(" ");
  if (links(source) !== links(value)) out.push("link targets differ");
  if (isPlural(source) !== isPlural(value)) out.push(isPlural(source) ? "must be a plural object" : "must be a plain string");
  else if (isPlural(value)) {
    const need = requiredPluralCategories(getLocale(locale).code).sort();
    const have = Object.keys(value).sort();
    const missing = need.filter((c) => !have.includes(c));
    const extra = have.filter((c) => !need.includes(c as Intl.LDMLPluralRule));
    if (missing.length) out.push(`plural forms missing: ${missing.join(",")}`);
    if (extra.length) out.push(`plural forms not used by ${locale}: ${extra.join(",")}`);
    if (!textsOf(value).some((t) => t.includes("{count}")) && textsOf(source).some((t) => t.includes("{count}"))) out.push("plural text lost {count}");
  }
  if (isSlugKey(key)) {
    const v = typeof value === "string" ? value : "";
    if (!SLUG_RE.test(v)) out.push(`slug must be lower-case ASCII kebab-case (got "${v}")`);
    if (!getLocale(locale).latin && v !== source) out.push("non-Latin locales keep the English slug");
  }
  return out;
}

export interface KeyReport {
  ns: string;
  key: string;
  state: KeyState;
  problems?: string[];
}

export interface LocaleReport {
  locale: string;
  published: boolean;
  method: LocaleStatusFile["method"];
  translator: string;
  translatedAt: string | null;
  total: number;
  counts: Record<KeyState, number>;
  extra: Array<{ ns: string; key: string }>;
  duplicateSlugs: string[];
  keys: KeyReport[];
  /** No missing, invalid, untranslated or extra keys and no slug collisions: may be built. */
  complete: boolean;
  /** Every key reviewed. */
  fullyReviewed: boolean;
  reviewers: string[];
}


export function localeReport(locale: string): LocaleReport {
  const hit = reportCache.get(locale);
  if (hit) return hit;
  const status = readStatusFile(locale);
  const same = new Set(status.intentionalSame);
  const counts: Record<KeyState, number> = { missing: 0, invalid: 0, untranslated: 0, machine: 0, unreviewed: 0, reviewed: 0, stale: 0 };
  const keys: KeyReport[] = [];
  const extra: Array<{ ns: string; key: string }> = [];
  for (const ns of NAMESPACE_IDS) {
    const src = loadNamespace("en", ns);
    const tr = locale === "en" ? src : loadNamespace(locale, ns);
    for (const key of Object.keys(src)) {
      const s = src[key];
      const v = tr[key];
      let state: KeyState;
      let problems: string[] | undefined;
      if (locale === "en") state = "reviewed";
      else if (v === undefined) state = "missing";
      else if ((problems = validateMessage(locale, key, s, v)).length) state = "invalid";
      else if (!isSlugKey(key) && !same.has(`${ns}:${key}`) && JSON.stringify(v) === JSON.stringify(s) && textsOf(s).some(hasTranslatableWords)) state = "untranslated";
      else {
        const r = status.reviews[`${ns}:${key}`];
        state = !r ? (status.method === "human" ? "unreviewed" : "machine") : r.src === hashMessage(s) && r.val === hashMessage(v) ? "reviewed" : "stale";
      }
      counts[state]++;
      keys.push(problems && problems.length ? { ns, key, state, problems } : { ns, key, state });
    }
    if (locale !== "en") for (const key of Object.keys(tr)) if (!(key in src)) extra.push({ ns, key });
  }
  // Every URL a locale produces must be unique: tool slugs and route segments share the first level.
  const dup: string[] = [];
  if (locale !== "en") {
    const reg = loadNamespace(locale, "registry");
    const common = loadNamespace(locale, "common");
    const first = [...Object.keys(reg).filter((k) => /^tool\.[^.]+\.slug$/.test(k)).map((k) => reg[k]), ...Object.keys(common).filter((k) => k.startsWith("route.")).map((k) => common[k])];
    const seen = new Set<string>();
    for (const v of first) if (typeof v === "string") (seen.has(v) ? dup.push(v) : seen.add(v));
    const catSlugs = Object.keys(reg).filter((k) => /^category\.[^.]+\.slug$/.test(k)).map((k) => reg[k]);
    if (new Set(catSlugs).size !== catSlugs.length) dup.push("(category slugs)");
    const g = loadNamespace(locale, "guides");
    const gSlugs = Object.keys(g).filter((k) => /^guide\.[^.]+\.slug$/.test(k)).map((k) => g[k]);
    if (new Set(gSlugs).size !== gSlugs.length) dup.push("(guide slugs)");
  }
  const total = keys.length;
  const complete = counts.missing === 0 && counts.invalid === 0 && counts.untranslated === 0 && extra.length === 0 && dup.length === 0;
  const reviewers = [...new Set(Object.values(status.reviews).map((r) => r.by))].sort();
  const rep: LocaleReport = {
    locale,
    published: PUBLISHED_LOCALES.includes(locale),
    method: locale === "en" ? "human" : status.method,
    translator: locale === "en" ? "Source (English)" : status.translator,
    translatedAt: status.translatedAt,
    total,
    counts,
    extra,
    duplicateSlugs: dup,
    keys,
    complete,
    fullyReviewed: complete && counts.reviewed === total,
    reviewers,
  };
  reportCache.set(locale, rep);
  return rep;
}

/** Locales that are built: published and complete. A published locale that is incomplete stops the build. */
export function builtLocales(): string[] {
  const bad = PUBLISHED_LOCALES.filter((l) => !isKnownLocale(l) || !localeReport(l).complete);
  if (bad.length && process.env.I18N_ALLOW_INCOMPLETE !== "1") {
    const why = bad.map((l) => {
      const r = localeReport(l);
      return `${l}: missing ${r.counts.missing}, invalid ${r.counts.invalid}, untranslated ${r.counts.untranslated}, extra ${r.extra.length}${r.duplicateSlugs.length ? `, duplicate slugs ${r.duplicateSlugs.join(" ")}` : ""}`;
    });
    throw new Error(`[i18n] Published locales with incomplete catalogues (fix them or remove them from PUBLISHED_LOCALES):\n  ${why.join("\n  ")}`);
  }
  return PUBLISHED_LOCALES.filter((l) => isKnownLocale(l) && localeReport(l).complete);
}

/** A key matcher for page requirements: namespace + key prefix (or exact key). */
export type KeyMatcher = { ns: string; prefix?: string; re?: RegExp };

/** True when every key matched is reviewed (English is always reviewed). */
export function allReviewed(locale: string, matchers: KeyMatcher[]): boolean {
  if (locale === "en") return true;
  const rep = localeReport(locale);
  if (!rep.complete) return false;
  return rep.keys.every((k) => k.state === "reviewed" || !matchers.some((m) => m.ns === k.ns && (m.prefix === undefined || k.key.startsWith(m.prefix)) && (!m.re || m.re.test(k.key))));
}
