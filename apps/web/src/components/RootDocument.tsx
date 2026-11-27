import "@/app/fonts.css";
import "@/app/globals.css";
import { Footer } from "./Footer";
import { Header, type NavCategory, type NavLinks } from "./Header";
import { InstallPrompt } from "./InstallPrompt";
import { ThemeScript } from "./ThemeScript";
import { LanguageSuggest, type SuggestText } from "./LanguageSuggest";
import type { LanguageOption } from "./LanguageSelector";
import { categories, getTool, tools, toolsInCategory } from "@/lib/registry";
import { I18nProvider } from "@/i18n/client";
import { ToolIndexProvider, type ToolIndexData } from "@/i18n/tool-index";
import { clientMessages, getT, loadNamespace } from "@/i18n/server";
import { builtLocales, localeReport } from "@/i18n/catalogue";
import { getLocale } from "@/i18n/locales";
import { pathFor } from "@/i18n/routes";
import { localizeCategory, localizeTool } from "@/i18n/source";

// Changes on every build: a new service worker URL makes browsers pick up the new version.
const BUILD_VERSION = process.env.NEXT_PUBLIC_BUILD_ID || new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);

/** Namespaces every page ships to the browser (site shell + downloader errors). */
export const SHELL_NAMESPACES = ["common"];

export function languageOptions(): LanguageOption[] {
  return builtLocales().map((code) => {
    const l = getLocale(code);
    const r = localeReport(code);
    return { code: l.code, native: l.native, name: l.name, dir: l.dir, home: pathFor(code, { kind: "home" }), status: code === "en" ? "source" : r.fullyReviewed ? "reviewed" : "machine" };
  });
}

function suggestTexts(): Record<string, SuggestText> {
  return Object.fromEntries(
    builtLocales().map((code) => {
      const t = getT(code, "common");
      return [code, { text: t("lang.suggest", { language: getLocale(code).native }), yes: t("lang.suggestYes"), no: t("lang.suggestNo") }];
    }),
  );
}

function toolIndex(locale: string): ToolIndexData {
  const toolsPath = pathFor(locale, { kind: "tools" });
  if (locale === "en") return { toolsPath };
  const reg = loadNamespace(locale, "registry");
  return {
    toolsPath,
    text: Object.fromEntries(tools.map((t) => {
      const l = localizeTool(t, reg);
      return [t.slug, { name: l.name, tagline: l.tagline, category: localizeCategory(categories.find((c) => c.id === t.category)!, reg).name }];
    })),
    href: Object.fromEntries(tools.map((t) => [t.slug, pathFor(locale, { kind: "tool", slug: t.slug })])),
    categoryNames: Object.fromEntries(categories.map((c) => [c.id, localizeCategory(c, reg).name])),
  };
}

/** <html> … </body> for one locale: correct lang and dir, translated shell, only this locale's strings. */
export function RootDocument({ locale, children }: { locale: string; children: React.ReactNode }) {
  const info = getLocale(locale);
  const t = getT(locale, "common");
  const reg = loadNamespace(locale, "registry");
  const nav: NavCategory[] = categories.map((c) => ({
    name: localizeCategory(c, reg).name,
    href: pathFor(locale, { kind: "category", id: c.id }),
    icon: c.icon,
    tools: toolsInCategory(c.id).map((x) => ({ name: localizeTool(x, reg).name, href: pathFor(locale, { kind: "tool", slug: x.slug }) })),
  }));
  const catPath = pathFor(locale, { kind: "category", id: categories[0].id });
  const links: NavLinks = {
    home: pathFor(locale, { kind: "home" }),
    downloader: pathFor(locale, { kind: "tool", slug: getTool("social-media-downloader")!.slug }),
    tools: pathFor(locale, { kind: "tools" }),
    guides: pathFor(locale, { kind: "guides" }),
    about: pathFor(locale, { kind: "about" }),
    categoryPrefix: catPath.slice(0, catPath.slice(0, -1).lastIndexOf("/") + 1),
  };
  const languages = languageOptions();
  return (
    <html lang={info.code} dir={info.dir} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <I18nProvider locale={info.code} messages={clientMessages(locale, SHELL_NAMESPACES)}>
          <ToolIndexProvider value={toolIndex(locale)}>
            <a href="#main" className="skip-link">
              {t("skip")}
            </a>
            <Header nav={nav} links={links} languages={languages} />
            <LanguageSuggest languages={languages} texts={suggestTexts()} />
            <main id="main">{children}</main>
            <Footer locale={locale} />
            <InstallPrompt version={BUILD_VERSION} />
          </ToolIndexProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
