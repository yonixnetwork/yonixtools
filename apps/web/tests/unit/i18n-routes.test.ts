/** Localized URL architecture: English URLs unchanged, round-trips, no collisions, eligibility rules. */
import { describe, expect, it } from "vitest";
import { allPages, isIndexableIn, localizeHref, pathFor, resolvePath, hreflangFor, pageId } from "@/i18n/routes";
import { localesOnDisk } from "@/i18n/server";
import { localeReport } from "@/i18n/catalogue";
import { getLocale, localeFromPrefix } from "@/i18n/locales";
import { makeTranslator } from "@/i18n/translator";
import { loadNamespace } from "@/i18n/server";
import { errorMessage } from "@/lib/downloader/error-message";
import { formatBytes, formatNumber, render } from "@/i18n/format";
import { matchBrowserLanguage } from "@/components/LanguageSuggest";

const complete = localesOnDisk().filter((l) => localeReport(l).complete);

describe("English URLs are unchanged", () => {
  it("keeps the original paths", () => {
    expect(pathFor("en", { kind: "home" })).toBe("/");
    expect(pathFor("en", { kind: "tool", slug: "pdf-merger" })).toBe("/pdf-merger/");
    expect(pathFor("en", { kind: "category", id: "pdf" })).toBe("/category/pdf-tools/");
    expect(pathFor("en", { kind: "guide", slug: "how-to-merge-pdf-files" })).toBe("/guides/how-to-merge-pdf-files/");
    expect(pathFor("en", { kind: "tools" })).toBe("/tools/");
    expect(pathFor("en", { kind: "privacy" })).toBe("/privacy/");
  });
});

describe.each(["en", ...complete.filter((l) => l !== "en")])("routes in %s", (l) => {
  it("every page has a unique path that resolves back to it", () => {
    const seen = new Map<string, string>();
    for (const p of allPages()) {
      const path = pathFor(l, p);
      expect(path).toMatch(/^\/([a-z0-9-]+\/)*$/);
      if (l !== "en") expect(path.startsWith(`/${getLocale(l).prefix}/`)).toBe(true);
      expect(seen.has(path), `${path} used by ${seen.get(path)} and ${pageId(p)}`).toBe(false);
      seen.set(path, pageId(p));
      expect(pageId(resolvePath(l, path)!)).toBe(pageId(p));
    }
  });
  it("localizes internal links from English paths", () => {
    expect(localizeHref(l, "/pdf-merger/")).toBe(pathFor(l, { kind: "tool", slug: "pdf-merger" }));
    expect(localizeHref(l, "/guides/#x")).toBe(`${pathFor(l, { kind: "guides" })}#x`);
    expect(localizeHref(l, "https://example.com/")).toBe("https://example.com/");
  });
  it("machine translations are never indexable; English pages are", () => {
    const reviewed = localeReport(l).counts.reviewed;
    for (const p of allPages()) if (l !== "en" && reviewed === 0) expect(isIndexableIn(l, p)).toBe(false);
    if (l === "en") expect(isIndexableIn("en", { kind: "tool", slug: "pdf-merger" })).toBe(true);
    expect(isIndexableIn(l, { kind: "offline" })).toBe(false);
  });
});

describe("hreflang", () => {
  it("is empty unless at least two indexable versions exist (no hreflang to noindex pages)", () => {
    for (const p of allPages()) {
      const h = hreflangFor(p);
      const versions = Object.keys(h).filter((k) => k !== "x-default");
      expect(versions.length === 0 || versions.length >= 2).toBe(true);
      if (versions.length) expect(h["x-default"]).toBe(pathFor("en", p));
    }
  });
});

describe("prefixes", () => {
  it("map to locales; English has none", () => {
    expect(localeFromPrefix("pt-br")?.code).toBe("pt-BR");
    expect(localeFromPrefix("zh-cn")?.code).toBe("zh-CN");
    expect(localeFromPrefix("pdf-merger")).toBeUndefined();
    expect(localeFromPrefix("")).toBeUndefined();
  });
});

describe("formatting", () => {
  it("plurals follow each locale's rules; numbers and sizes are localized", () => {
    expect(render("en", { one: "{count} file", other: "{count} files" }, { count: 1 })).toBe("1 file");
    expect(render("en", { one: "{count} file", other: "{count} files" }, { count: 1200 })).toBe("1,200 files");
    expect(render("ar", { zero: "z", one: "o", two: "t", few: "f", many: "m", other: "x" }, { count: 3 })).toBe("f");
    expect(formatNumber("de", 1234.5)).toBe("1.234,5");
    expect(formatNumber("hi", 1234567)).toBe("12,34,567");
    expect(formatBytes("en", 2048)).toBe("2 kB");
  });
});

describe("browser-language suggestion matching", () => {
  it("matches exact tags, then the base language; never invents one", () => {
    const codes = ["en", "es", "pt-BR", "zh-CN"];
    expect(matchBrowserLanguage(["es-MX", "en"], codes)).toBe("es");
    expect(matchBrowserLanguage(["pt"], codes)).toBe("pt-BR");
    expect(matchBrowserLanguage(["zh-CN"], codes)).toBe("zh-CN");
    expect(matchBrowserLanguage(["fi"], codes)).toBeUndefined();
  });
});

describe.each(complete.filter((l) => l !== "en"))("downloader API errors in %s", (l) => {
  it("are shown from the catalogue by error code, never the server's English text", () => {
    const t = makeTranslator(l, "errors", loadNamespace(l, "errors"));
    const en = loadNamespace("en", "errors");
    for (const code of ["private", "rate_limited", "unavailable", "server_error"]) {
      const msg = errorMessage(t, { code });
      expect(msg).toBe(loadNamespace(l, "errors")[`code.${code}`]);
      expect(msg).not.toBe(en[`code.${code}`]);
    }
    expect(errorMessage(t, { code: "login_required", platform: "instagram" })).toBe(loadNamespace(l, "errors")["platform.instagram.login_required"]);
  });
});
