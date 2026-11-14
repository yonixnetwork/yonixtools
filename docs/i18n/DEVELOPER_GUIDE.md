# Translations: developer guide

YoniXTools is translated through one in-house i18n module, `apps/web/src/i18n/`. It is built on the standard `Intl` APIs and has no runtime server: everything is rendered into the static HTML at build time.

**Rule: every user-visible string goes through a translation key.** The CI check (`npm run i18n:check`) fails on missing, extra or invalid keys.

## Where things live

| Path | What |
|---|---|
| `src/i18n/locales.ts` | The 100 locales (BCP 47 code, URL prefix, native name, direction, script) |
| `src/i18n/namespaces.ts` | Namespaces = catalogue files, and which ones are shipped to the browser |
| `src/i18n/messages/<locale>/<ns>.json` | Catalogues. English (`en`) is the source |
| `src/i18n/review/<locale>.json` | Human review records (who reviewed which key, when, against which source text) |
| `src/i18n/format.ts` | Plurals, placeholders, number, date and size formatting |
| `src/i18n/client.tsx` | `useT`, `useFormat`, `useLocale` and `I18nProvider` for client components |
| `src/i18n/server.ts` | `getT` and catalogue loading for server components (build time) |

**Generated:** English `registry` and `guides` come from `src/lib/registry` and `src/lib/guides.ts`. Edit those files, then run `npm run i18n:sync`.

## Writing a component

```tsx
"use client";
import { useFormat, useT } from "@/i18n/client";

export function PdfMerger() {
  const t = useT("tools-pdf");              // the component's namespace
  const f = useFormat();
  return (
    <>
      <button aria-label={t("merge.addAria")}>{t("merge.add")}</button>
      <p>{t("merge.count", { count: files.length })}</p>     {/* plural */}
      <p>{f.bytes(blob.size)}</p>                              {/* "1.2 MB" in the locale */}
      <p>{t.rich("merge.note", { b: (c) => <strong>{c}</strong> })}</p>
    </>
  );
}
```

**Server components:** use `const t = getT(locale, "pages")` with the same API.

**Messages** (`messages/en/tools-pdf.json`), with flat, dotted, stable keys:

```json
{
  "merge.add": "Add PDFs",
  "merge.count": { "one": "{count} file", "other": "{count} files" },
  "merge.note": "Files are processed <b>on your device</b>."
}
```

- **Placeholders** are written `{name}`. Numbers passed as values are formatted for the locale.
- **Plurals** are objects keyed by CLDR category (`zero` `one` `two` `few` `many` `other`). Each locale must have exactly the categories its plural rules need (Arabic needs 6, Japanese 1), and the checker verifies this.
- **Markup** uses `<tag>…</tag>` and `t.rich`. Tags can't be nested.
- **The English value is the exact text shown today.** Changing English text means changing the source.

**Errors from library code:** `throw new UserError("pdf.notPdf")` (from `@/i18n/errors`). The component catches it and renders `t(err.key, err.vars)`.

## What NOT to translate

- Brand and product names (YoniXTools, TikTok, Instagram…).
- Technical identifiers and formats (JSON, Base64, UUID, MP4, `.pdf`).
- Code samples, generated code and markup output.
- URLs, and user-provided content or filenames.
- Values used by logic, such as option values and ids. Translate only the labels.

**Tool outputs that are data formats stay as they are.** ISO timestamps, robots.txt, meta tags and JSON are not localised. Only the UI around them is.

## Adding a language

1. The locale must exist in `locales.ts` (all 100 do).
2. Copy every `messages/en/*.json` file (run `npm run i18n:sync` first) to `messages/<code>/` and translate it.
   - `registry` and `guides` contain `…slug` keys. Latin-script locales give ASCII kebab-case slugs from keyword research. Other scripts copy the English slug.
   - `common` contains `route.*` URL segments under the same rule.
3. Run `npm run i18n:check`.
   - **A complete catalogue** (no missing, extra or invalid keys) is built under `/<prefix>/`.
   - **An incomplete catalogue is never built.**
4. **Translation status:**
   - Everything starts as `machine` or `unreviewed`, and those pages are `noindex`.
   - A reviewer records approval with `npm run i18n:review -- <locale> <key-pattern> "<Reviewer name>"`. The review stores hashes of the English source and of the translation.
   - Changing either text invalidates that review automatically.
   - A page becomes indexable only when every key it uses is reviewed.
5. Regenerate the coverage report with `npm run i18n:report` (`docs/i18n/TRANSLATION_COVERAGE.md`).

## Translating a new feature

1. Add the English keys.
2. CI fails for every built locale that is missing them, so the locale stops building until it's translated. Release the feature together with its translations, or wait.
3. Reviews of changed keys become stale, and the affected pages drop back to `noindex` until re-reviewed.
