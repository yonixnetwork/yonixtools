/**
 * The human-review workflow end to end, in memory (the real status files are never written):
 * machine translations are not indexable; a page becomes indexable once a named person has
 * reviewed every key it shows; hreflang then links the reviewed versions reciprocally; and a
 * review goes stale (page back to noindex) when the English or the translation changes.
 */
import { afterEach, describe, expect, it } from "vitest";
import { __setStatusForTest, hashMessage, localeReport, readStatusFile, type LocaleStatusFile } from "@/i18n/catalogue";
import { hreflangFor, isIndexableIn, pageKeys, pathFor } from "@/i18n/routes";
import { loadNamespace } from "@/i18n/server";
import { NAMESPACE_IDS } from "@/i18n/namespaces";
import { getLocale } from "@/i18n/locales";

const LOCALE = "es";
const PAGE = { kind: "privacy" } as const;

/** Review records for every key a page shows, as `npm run i18n:review` would write them. */
function reviewsFor(locale: string, page: typeof PAGE, tamper?: string): LocaleStatusFile["reviews"] {
  const matchers = pageKeys(page);
  const out: LocaleStatusFile["reviews"] = {};
  for (const ns of NAMESPACE_IDS) {
    const src = loadNamespace("en", ns), tr = loadNamespace(locale, ns);
    for (const key of Object.keys(src)) {
      if (!matchers.some((m) => m.ns === ns && (m.prefix === undefined || key.startsWith(m.prefix)) && (!m.re || m.re.test(key)))) continue;
      const id = `${ns}:${key}`;
      out[id] = { by: "Test Reviewer", date: "2026-11-27", src: id === tamper ? "0000000000000000" : hashMessage(src[key]), val: hashMessage(tr[key]) };
    }
  }
  return out;
}

afterEach(() => __setStatusForTest(LOCALE, undefined));

describe("human review → indexing", () => {
  it("a machine-translated page is not indexable and has no hreflang", () => {
    expect(isIndexableIn(LOCALE, PAGE)).toBe(false);
    expect(hreflangFor(PAGE)).toEqual({});
  });

  it("reviewing every key of a page makes it indexable, with reciprocal hreflang + x-default", () => {
    const base = readStatusFile(LOCALE);
    __setStatusForTest(LOCALE, { ...base, reviews: reviewsFor(LOCALE, PAGE) });
    expect(isIndexableIn(LOCALE, PAGE)).toBe(true);
    const h = hreflangFor(PAGE);
    expect(h).toEqual({ en: pathFor("en", PAGE), [getLocale(LOCALE).code]: pathFor(LOCALE, PAGE), "x-default": pathFor("en", PAGE) });
    // Other pages of the locale stay noindex: only the reviewed page's keys were approved.
    expect(isIndexableIn(LOCALE, { kind: "tool", slug: "pdf-merger" })).toBe(false);
    // The report counts reviews and names the reviewer; the locale is not fully reviewed.
    const r = localeReport(LOCALE);
    expect(r.counts.reviewed).toBeGreaterThan(0);
    expect(r.reviewers).toEqual(["Test Reviewer"]);
    expect(r.fullyReviewed).toBe(false);
  });

  it("a review becomes stale when the reviewed text changes, and the page drops back to noindex", () => {
    const base = readStatusFile(LOCALE);
    __setStatusForTest(LOCALE, { ...base, reviews: reviewsFor(LOCALE, PAGE, "pages:privacy.h1") });
    expect(localeReport(LOCALE).keys.find((k) => k.ns === "pages" && k.key === "privacy.h1")?.state).toBe("stale");
    expect(isIndexableIn(LOCALE, PAGE)).toBe(false);
  });
});
