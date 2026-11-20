/**
 * Translation catalogue checks (CI: npm run i18n:check, also part of npm test).
 *  - English source: generated namespaces in sync with the registry, no duplicate keys, valid
 *    placeholders and plural objects, every literal key used in code exists.
 *  - Every PUBLISHED locale: complete (no missing / invalid / untranslated / extra keys, unique slugs).
 *  - Every locale directory on disk belongs to a known BCP 47 locale.
 * Set I18N_WRITE=1 to regenerate messages/en/registry.json and guides.json (npm run i18n:sync).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NAMESPACE_IDS, NAMESPACES } from "@/i18n/namespaces";
import { MESSAGES_DIR, loadNamespace, localesOnDisk } from "@/i18n/server";
import { guidesSource, registrySource } from "@/i18n/source";
import { localeReport, validateMessage } from "@/i18n/catalogue";
import { PUBLISHED_LOCALES } from "@/i18n/config";
import { LOCALES, isKnownLocale } from "@/i18n/locales";
import { isPlural, requiredPluralCategories } from "@/i18n/format";

const write = process.env.I18N_WRITE === "1";
const json = (o: object) => JSON.stringify(Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))), null, 2) + "\n";

describe("English source catalogue", () => {
  for (const [ns, build] of [["registry", registrySource], ["guides", guidesSource]] as const) {
    it(`${ns}.json is generated from the source (npm run i18n:sync)`, () => {
      const file = path.join(MESSAGES_DIR, "en", `${ns}.json`);
      const want = json(build());
      if (write) fs.writeFileSync(file, want);
      expect(fs.existsSync(file), `${file} missing: run npm run i18n:sync`).toBe(true);
      expect(fs.readFileSync(file, "utf8") === want, `${ns}.json is out of date: run npm run i18n:sync`).toBe(true);
    });
  }

  it("every namespace has an English file", () => {
    for (const ns of NAMESPACE_IDS) expect(fs.existsSync(path.join(MESSAGES_DIR, "en", `${ns}.json`)), ns).toBe(true);
  });

  it("no catalogue file in any locale has duplicate keys", () => {
    const dupes: string[] = [];
    for (const l of localesOnDisk())
      for (const f of fs.readdirSync(path.join(MESSAGES_DIR, l)).filter((x) => x.endsWith(".json"))) {
        const raw = fs.readFileSync(path.join(MESSAGES_DIR, l, f), "utf8");
        const seen = new Set<string>();
        // top-level keys only: lines like `  "key": …` at two-space indent
        for (const m of raw.matchAll(/^ {2}"((?:[^"\\]|\\.)*)":/gm)) (seen.has(m[1]) ? dupes.push(`${l}/${f}: ${m[1]}`) : seen.add(m[1]));
      }
    expect(dupes).toEqual([]);
  });

  it("English messages are well formed (plural objects, placeholders, no empty text)", () => {
    const bad: string[] = [];
    for (const ns of NAMESPACE_IDS)
      for (const [k, m] of Object.entries(loadNamespace("en", ns))) {
        if (typeof m === "string") {
          if (!m.trim()) bad.push(`${ns}:${k} empty`);
          if (/\{[^}a-zA-Z0-9_]*[^a-zA-Z0-9_}][^}]*\}/.test(m.replace(/\{[a-zA-Z0-9_]+\}/g, ""))) bad.push(`${ns}:${k} malformed placeholder`);
        } else if (!isPlural(m)) bad.push(`${ns}:${k} object without "other"`);
        else {
          const need = requiredPluralCategories("en");
          for (const c of need) if (!m[c]) bad.push(`${ns}:${k} missing plural "${c}"`);
        }
      }
    expect(bad).toEqual([]);
  });

  it("every literal translation key used in the code exists in English", () => {
    const missing: string[] = [];
    const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(d, e.name)] : []));
    let checked = 0;
    for (const file of walk(path.join(process.cwd(), "src")).filter((f) => !f.includes(`${path.sep}i18n${path.sep}`))) {
      const src = fs.readFileSync(file, "utf8");
      const vars = new Map<string, string>();
      for (const m of src.matchAll(/(?:const|let)\s+(\w+)\s*=\s*(?:useT\(\s*"([\w-]+)"\s*\)|getT\([^,()]+,\s*"([\w-]+)"\s*\))/g)) vars.set(m[1], m[2] ?? m[3]);
      for (const m of src.matchAll(/\b(\w+)(?:\.rich)?\(\s*"([A-Za-z][\w.-]*)"/g)) {
        const ns = vars.get(m[1]);
        if (!ns) continue;
        checked++;
        if (loadNamespace("en", ns)[m[2]] === undefined) missing.push(`${path.relative(process.cwd(), file)}: ${ns}:${m[2]}`);
      }
    }
    expect(checked).toBeGreaterThan(500);
    expect(missing).toEqual([]);
  });

  it("client namespaces are declared", () => {
    expect(NAMESPACES.filter((n) => n.client).map((n) => n.id)).toContain("common");
  });
});

describe("Locale catalogues", () => {
  it("100 locales with unique BCP 47 codes and URL prefixes", () => {
    expect(LOCALES).toHaveLength(100);
    expect(new Set(LOCALES.map((l) => l.code)).size).toBe(100);
    expect(new Set(LOCALES.map((l) => l.prefix)).size).toBe(100);
    for (const l of LOCALES) {
      expect(() => new Intl.Locale(l.code), l.code).not.toThrow();
      expect(Intl.getCanonicalLocales(l.code)[0], l.code).toBe(l.code);
    }
    expect(LOCALES.filter((l) => l.priority)).toHaveLength(20);
  });

  it("every catalogue directory is a known locale", () => {
    for (const l of localesOnDisk()) expect(isKnownLocale(l), l).toBe(true);
  });

  for (const locale of PUBLISHED_LOCALES.filter((l) => l !== "en")) {
    it(`${locale}: published locale is complete and valid`, () => {
      const r = localeReport(locale);
      const problems = r.keys.filter((k) => k.state === "missing" || k.state === "invalid" || k.state === "untranslated").slice(0, 25).map((k) => `${k.state} ${k.ns}:${k.key}${k.problems ? ` (${k.problems.join("; ")})` : ""}`);
      expect({ problems, extra: r.extra.slice(0, 10), duplicateSlugs: r.duplicateSlugs }).toEqual({ problems: [], extra: [], duplicateSlugs: [] });
      expect(r.complete).toBe(true);
    });
  }
});

describe("validator", () => {
  it("catches placeholder, tag, plural and slug problems", () => {
    expect(validateMessage("es", "a", "Hi {name}", "Hola")).toContain("placeholders differ: en {name} vs {}");
    expect(validateMessage("es", "a", "a <b>b</b>", "a b")[0]).toMatch(/rich tags/);
    expect(validateMessage("ar", "a", { one: "{count} file", other: "{count} files" }, { one: "{count}", other: "{count}" }).join()).toMatch(/plural forms missing: few,many,two,zero/);
    expect(validateMessage("ja", "a", { one: "{count} file", other: "{count} files" }, { one: "{count}", other: "{count}" }).join()).toMatch(/not used by ja: one/);
    expect(validateMessage("es", "tool.x.slug", "pdf-merger", "Unir PDF")[0]).toMatch(/kebab/);
    expect(validateMessage("ja", "tool.x.slug", "pdf-merger", "pdf-ketsugo")).toContain("non-Latin locales keep the English slug");
    expect(validateMessage("es", "a", "See [the guide](/guides/x/)", "Ver [la guía](/guides/y/)")).toContain("link targets differ");
  });
});
