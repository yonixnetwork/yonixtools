import { Fragment, type ReactNode } from "react";
import { missingMarker, render, type Messages, type Vars } from "./format";

/** Callbacks that render rich tags: { link: (chunks) => <a href="…">{chunks}</a> }. */
export type RichTags = Record<string, (chunks: ReactNode) => ReactNode>;

export interface Translator {
  (key: string, vars?: Vars): string;
  /** Message with markup tags (<b>…</b>, <link>…</link>) rendered by the given callbacks. */
  rich(key: string, tags: RichTags, vars?: Vars): ReactNode;
  /** True if the key exists (for optional content). */
  has(key: string): boolean;
  locale: string;
}

const warned = new Set<string>();
function warnMissing(ns: string, key: string, locale: string) {
  if (process.env.NODE_ENV === "production") return;
  const id = `${locale}:${ns}:${key}`;
  if (warned.has(id)) return;
  warned.add(id);
  console.warn(`[i18n] missing translation ${id}`);
}

/** Render "a <b>b</b> c" with tag callbacks. Unknown tags render their text only. Not nested. */
export function renderRich(text: string, tags: RichTags): ReactNode {
  const out: ReactNode[] = [];
  const re = /<([a-zA-Z][a-zA-Z0-9]*)>(.*?)<\/\1>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const fn = tags[m[1]];
    out.push(<Fragment key={i++}>{fn ? fn(m[2]) : m[2]}</Fragment>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.length === 1 ? out[0] : <>{out}</>;
}

export function makeTranslator(locale: string, ns: string, messages: Messages | undefined): Translator {
  const get = (key: string, vars?: Vars) => {
    const m = messages?.[key];
    if (m === undefined) {
      warnMissing(ns, key, locale);
      return missingMarker(ns, key);
    }
    return render(locale, m, vars);
  };
  const t = get as Translator;
  t.rich = (key, tags, vars) => renderRich(get(key, vars), tags);
  t.has = (key) => messages?.[key] !== undefined;
  t.locale = locale;
  return t;
}
