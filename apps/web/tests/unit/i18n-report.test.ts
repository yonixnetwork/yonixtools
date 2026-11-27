/**
 * npm run i18n:report (I18N_WRITE=1) regenerates docs/i18n/TRANSLATION_COVERAGE.md.
 * npm run i18n:review applies a review record (env I18N_REVIEW_LOCALE, I18N_REVIEW_KEYS, I18N_REVIEWER).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { coverage, coverageMarkdown } from "@/i18n/report";
import { STATUS_DIR, hashMessage, readStatusFile } from "@/i18n/catalogue";
import { NAMESPACE_IDS } from "@/i18n/namespaces";
import { loadNamespace } from "@/i18n/server";
import { isKnownLocale } from "@/i18n/locales";

const DOC = path.join(process.cwd(), "..", "..", "docs", "i18n", "TRANSLATION_COVERAGE.md");

describe("translation coverage report", () => {
  it("covers all 100 locales and never calls a machine translation reviewed", () => {
    const rows = coverage();
    expect(rows).toHaveLength(100);
    for (const r of rows) {
      if (r.code === "en") continue;
      if (r.status === "HUMAN-REVIEWED") expect(r.counts.reviewed).toBe(r.total);
      if (r.counts.reviewed === 0) expect(r.pagesIndexable).toBe(0);
      if (!r.built) expect(r.pagesIndexable).toBe(0);
    }
  });

  it.runIf(process.env.I18N_WRITE === "1")("writes docs/i18n/TRANSLATION_COVERAGE.md", () => {
    fs.writeFileSync(DOC, coverageMarkdown(new Date().toISOString().slice(0, 10)));
    expect(fs.existsSync(DOC)).toBe(true);
  });
});

describe.runIf(!!process.env.I18N_REVIEW_LOCALE)("record a human review", () => {
  it("adds review entries for the matching keys", () => {
    const locale = process.env.I18N_REVIEW_LOCALE!;
    const pattern = process.env.I18N_REVIEW_KEYS ?? "";
    const by = (process.env.I18N_REVIEWER ?? "").trim();
    expect(isKnownLocale(locale) && locale !== "en", "I18N_REVIEW_LOCALE must be a translated locale").toBe(true);
    expect(by.length >= 2, "I18N_REVIEWER must name the person who reviewed the translation").toBe(true);
    // pattern: "<ns>:<key glob>", e.g. "registry:tool.pdf-merger.*" or "*:*"
    const [nsGlob, keyGlob] = pattern.split(":");
    const re = (g: string) => new RegExp(`^${g.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`);
    const nsRe = re(nsGlob || "*"), keyRe = re(keyGlob || "*");
    const file = path.join(STATUS_DIR, `${locale}.json`);
    const status = readStatusFile(locale);
    const date = new Date().toISOString().slice(0, 10);
    let n = 0;
    for (const ns of NAMESPACE_IDS.filter((x) => nsRe.test(x))) {
      const src = loadNamespace("en", ns), tr = loadNamespace(locale, ns);
      for (const k of Object.keys(src).filter((x) => keyRe.test(x))) {
        if (tr[k] === undefined) continue;
        status.reviews[`${ns}:${k}`] = { by, date, src: hashMessage(src[k]), val: hashMessage(tr[k]) };
        n++;
      }
    }
    fs.mkdirSync(STATUS_DIR, { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ ...status, reviews: Object.fromEntries(Object.entries(status.reviews).sort()) }, null, 2) + "\n");
    console.log(`Recorded ${n} reviewed keys for ${locale} by ${by}.`);
    expect(n).toBeGreaterThan(0);
  });
});
