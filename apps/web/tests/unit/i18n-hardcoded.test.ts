/**
 * No user-visible English hard-coded in components, views or pages: JSX text and the
 * aria-label / placeholder / title / alt attributes must come from the catalogue (t("…")).
 * A heuristic scan: it flags word-like text between tags and literal attribute values.
 * Legitimate exceptions (sample input data, example URLs, the English-only admin page) are listed
 * below with a reason; anything new fails CI until it uses a translation key or is justified here.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.join(process.cwd(), "src");
const walk = (d: string): string[] =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith(".tsx") ? [path.join(d, e.name)] : []));

/** file (relative to src) → literal snippets allowed there, with the reason. */
const ALLOWED: Record<string, { snippets: string[]; why: string }> = {
  "app/(en)/admin/translations/page.tsx": { snippets: ["*"], why: "password-protected admin page, English only by design (single administrator)" },
  "app/global-not-found.tsx": { snippets: ["*"], why: "uses catalogue text; no literal UI strings (listed for its <html> markup)" },
  "components/tools/MinifyTools.tsx": { snippets: ["My page", "Hello,   world!"], why: "sample HTML input for the minifier (data, not UI)" },
  "components/tools/SeoExtraTools.tsx": { snippets: ["YoniXTools – Free Online Tools"], why: "sample <head> input for the Open Graph preview (data, not UI)" },
  "components/Logo.tsx": { snippets: ["Yoni", "Tools"], why: "the brand name YoniXTools, split around a bold X" },
  "components/tools/QrTools.tsx": { snippets: ["https://example.com", "MyHomeWiFi", "PNG", "SVG"], why: "example input values; file-format names on the download buttons" },
  "components/tools/SeoTools.tsx": { snippets: ["https://example.com/page", "https://example.com/og.png", "Googlebot"], why: "example URLs and a crawler name (identifiers)" },
};

/** Word-like JSX text: starts with a letter, made of words and sentence punctuation only. */
const JSX_TEXT = />\s*([A-Za-z][A-Za-z'’,.!?:;\-– ]*[A-Za-z.!?])\s*</g;
const ATTR = /\b(aria-label|placeholder|title|alt)="([^"{}]*[A-Za-z]{3,}[^"]*)"/g;

function findings(): string[] {
  const out: string[] = [];
  for (const file of walk(SRC)) {
    const rel = path.relative(SRC, file).split(path.sep).join("/");
    if (rel.startsWith("i18n/")) continue;
    const allowed = ALLOWED[rel];
    if (allowed?.snippets.includes("*")) continue;
    const src = fs.readFileSync(file, "utf8");
    const add = (text: string, at: number) => {
      if (allowed?.snippets.some((s) => text.includes(s))) return;
      out.push(`${rel}:${src.slice(0, at).split("\n").length}: ${text.slice(0, 70)}`);
    };
    for (const m of src.matchAll(JSX_TEXT)) {
      const t = m[1].trim();
      // Real text has at least one word of 3+ letters; skip TypeScript generics and code fragments.
      if (!/[A-Za-z]{3,}/.test(t) || /^(Promise|Array|Record|React)\b/.test(t) || /[;]/.test(t)) continue;
      add(t, m.index!);
    }
    for (const m of src.matchAll(ATTR)) add(`${m[1]}="${m[2]}"`, m.index!);
  }
  return out;
}

describe("no hard-coded user-visible English", () => {
  it("components, views and pages take their text from the catalogue", () => {
    expect(findings()).toEqual([]);
  });

  it("the scan really detects hard-coded text (self-test)", () => {
    const sample = `<button aria-label="Close menu">Download now</button>`;
    expect([...sample.matchAll(JSX_TEXT)].map((m) => m[1])).toEqual(["Download now"]);
    expect([...sample.matchAll(ATTR)].map((m) => m[2])).toEqual(["Close menu"]);
  });
});
