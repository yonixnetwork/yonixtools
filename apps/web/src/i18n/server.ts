/**
 * Server-side (build-time) catalogue access. Reads src/i18n/messages/<locale>/<ns>.json from disk
 * during `next build` (static export), so translations are baked into the HTML and never fetched.
 * English `registry` and `guides` come straight from the registry sources (see source.ts).
 */
import fs from "node:fs";
import path from "node:path";
import type { Messages } from "./format";
import { NAMESPACES, NAMESPACE_IDS } from "./namespaces";
import { makeTranslator, type Translator } from "./translator";
import { guidesSource, registrySource } from "./source";

export const MESSAGES_DIR = path.join(process.cwd(), "src", "i18n", "messages");
const cache = new Map<string, Messages>();

/** One namespace of one locale ({} if the file doesn't exist). */
export function loadNamespace(locale: string, ns: string): Messages {
  const id = `${locale}/${ns}`;
  const hit = cache.get(id);
  if (hit) return hit;
  let m: Messages = {};
  if (locale === "en" && ns === "registry") m = registrySource();
  else if (locale === "en" && ns === "guides") m = guidesSource();
  else {
    const file = path.join(MESSAGES_DIR, locale, `${ns}.json`);
    if (fs.existsSync(file)) m = JSON.parse(fs.readFileSync(file, "utf8")) as Messages;
  }
  cache.set(id, m);
  return m;
}

export function loadCatalogue(locale: string): Record<string, Messages> {
  return Object.fromEntries(NAMESPACE_IDS.map((ns) => [ns, loadNamespace(locale, ns)]));
}

/** The namespaces a page's client components need, for one locale (what gets shipped). */
export function clientMessages(locale: string, namespaces: string[]): Record<string, Messages> {
  const allowed = new Set(NAMESPACES.filter((n) => n.client).map((n) => n.id));
  return Object.fromEntries(namespaces.filter((ns) => allowed.has(ns)).map((ns) => [ns, loadNamespace(locale, ns)]));
}

export const getT = (locale: string, ns: string): Translator => makeTranslator(locale, ns, loadNamespace(locale, ns));

/** Locales that have a catalogue directory (candidates for building; completeness decides). */
export function localesOnDisk(): string[] {
  if (!fs.existsSync(MESSAGES_DIR)) return [];
  return fs.readdirSync(MESSAGES_DIR).filter((d) => fs.statSync(path.join(MESSAGES_DIR, d)).isDirectory());
}
