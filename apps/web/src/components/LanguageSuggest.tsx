"use client";
/**
 * A dismissible suggestion, never a redirect:
 *  - if the visitor chose a language before (language selector) and this page is in another one,
 *    offer the remembered language;
 *  - otherwise, if the browser's preferred language is a built language other than this page's,
 *    offer it.
 * The text is shown in the SUGGESTED language (one short sentence per language, passed in). IP
 * addresses are never used. Search engines see nothing: the banner only renders after hydration.
 * Also shows the notice after a switch to a language that has no equivalent of the previous page.
 */
import { Languages, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useLocale, useT } from "@/i18n/client";
import { getAlternates, subscribeAlternates } from "@/i18n/alternates";
import { LOCALE_PREF_KEY, rememberLocale, targetFor, type LanguageOption } from "./LanguageSelector";

const DISMISS_KEY = "ytx-locale-suggest-dismissed";

export interface SuggestText {
  text: string;
  yes: string;
  no: string;
}

/** Best built language for the browser's preferences: exact tag, then same language (pt → pt-BR). */
export function matchBrowserLanguage(prefs: readonly string[], codes: string[]): string | undefined {
  const lower = codes.map((c) => c.toLowerCase());
  for (const p of prefs) {
    const i = lower.indexOf(p.toLowerCase());
    if (i >= 0) return codes[i];
  }
  for (const p of prefs) {
    const base = p.toLowerCase().split("-")[0];
    const i = lower.findIndex((c) => c.split("-")[0] === base);
    if (i >= 0) return codes[i];
  }
  return undefined;
}

export function LanguageSuggest({ languages, texts }: { languages: LanguageOption[]; texts: Record<string, SuggestText> }) {
  const current = useLocale();
  const t = useT("common");
  const alternates = useSyncExternalStore(subscribeAlternates, getAlternates, () => ({}));
  const [suggest, setSuggest] = useState<LanguageOption | null>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(location.search).has("lang-fallback")) setFallback(true);
    let pref: string | null = null;
    let dismissed: string | null = null;
    try {
      pref = localStorage.getItem(LOCALE_PREF_KEY);
      dismissed = localStorage.getItem(DISMISS_KEY);
    } catch {
      /* no storage: suggestions based on the browser language only, never remembered */
    }
    if (pref === current.code) return;
    const codes = languages.map((l) => l.code);
    const code = pref && codes.includes(pref) ? pref : dismissed ? undefined : matchBrowserLanguage(navigator.languages ?? [navigator.language], codes);
    if (code && code !== current.code) setSuggest(languages.find((l) => l.code === code) ?? null);
  }, [current.code, languages]);

  if (fallback)
    return (
      <div className="lang-suggest container" role="status" data-testid="lang-fallback">
        <Languages aria-hidden />
        <span>{t("lang.fallback")}</span>
        <button type="button" className="icon-button" aria-label={t("lang.dismiss")} onClick={() => setFallback(false)}>
          <X aria-hidden />
        </button>
      </div>
    );
  if (!suggest) return null;
  const tx = texts[suggest.code];
  if (!tx) return null;
  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setSuggest(null);
  };
  return (
    <div className="lang-suggest container" role="region" aria-label={tx.text} lang={suggest.code} dir={suggest.dir} data-testid="lang-suggest">
      <Languages aria-hidden />
      <span>{tx.text}</span>
      <a
        className="btn btn-primary btn-sm"
        href={targetFor(suggest, alternates)}
        onClick={() => rememberLocale(suggest.code)}
      >
        {tx.yes}
      </a>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => (rememberLocale(current.code), dismiss())}>
        {tx.no}
      </button>
    </div>
  );
}
