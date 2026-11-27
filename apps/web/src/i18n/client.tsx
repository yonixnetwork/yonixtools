"use client";
/**
 * Client-side translations. A page ships only the namespaces its client components need, for its
 * own locale (passed down from the server as props), so no other language is ever downloaded.
 *
 *   <I18nProvider locale="es" messages={{ common: {...} }}>      (site shell)
 *     <I18nProvider messages={{ "tools-pdf": {...} }}>            (a page adds its namespaces)
 *   const t = useT("tools-pdf");  t("merge.button")  t("files", { count: 3 })
 */
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { formatBytes, formatDate, formatNumber, type Messages } from "./format";
import { makeTranslator, type Translator } from "./translator";
import { getLocale, type LocaleInfo } from "./locales";

interface Ctx {
  locale: string;
  messages: Record<string, Messages>;
}
const I18nContext = createContext<Ctx>({ locale: "en", messages: {} });

export function I18nProvider({ locale, messages, children }: { locale?: string; messages: Record<string, Messages>; children: ReactNode }) {
  const parent = useContext(I18nContext);
  const value = useMemo<Ctx>(() => ({ ...parent, locale: locale ?? parent.locale, messages: { ...parent.messages, ...messages } }), [parent, locale, messages]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(ns: string): Translator {
  const { locale, messages } = useContext(I18nContext);
  return useMemo(() => makeTranslator(locale, ns, messages[ns]), [locale, ns, messages]);
}

export const useLocale = (): LocaleInfo => getLocale(useContext(I18nContext).locale);

/** Locale-aware number, date and file-size formatting for client components. */
export function useFormat() {
  const { locale } = useContext(I18nContext);
  return useMemo(
    () => ({
      locale,
      number: (n: number, o?: Intl.NumberFormatOptions) => formatNumber(locale, n, o),
      date: (d: Date | string | number, o?: Intl.DateTimeFormatOptions) => formatDate(locale, d, o),
      bytes: (b: number) => formatBytes(locale, b),
    }),
    [locale],
  );
}
