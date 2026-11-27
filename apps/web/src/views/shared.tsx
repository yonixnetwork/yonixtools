import type { ReactNode } from "react";
import { I18nProvider } from "@/i18n/client";
import { PageAlternates } from "@/i18n/alternates";
import { allReviewed } from "@/i18n/catalogue";
import { alternatesFor, pageKeys, pathFor, type PageRef } from "@/i18n/routes";
import { clientMessages, getT, loadNamespace } from "@/i18n/server";
import { localizeTool } from "@/i18n/source";
import { getTool, type Tool } from "@/lib/registry";
import { toCard, type ToolCardData } from "@/lib/registry/cards";

/** Everything a view needs for one locale. */
export function viewContext(locale: string) {
  const reg = loadNamespace(locale, "registry");
  return {
    locale,
    t: getT(locale, "pages"),
    tc: getT(locale, "common"),
    path: (p: PageRef) => pathFor(locale, p),
    tool: (t: Tool): Tool => (locale === "en" ? t : localizeTool(t, reg)),
    toolBySlug: (slug: string): Tool => {
      const t = getTool(slug)!;
      return locale === "en" ? t : localizeTool(t, reg);
    },
    card: (t: Tool): ToolCardData => toCard(locale === "en" ? t : localizeTool(t, reg), pathFor(locale, { kind: "tool", slug: t.slug })),
  };
}
export type ViewContext = ReturnType<typeof viewContext>;

/**
 * Wraps a page: registers its language alternates (language selector), ships the client
 * namespaces it needs, and on machine-translated pages says so.
 */
export function ViewFrame({ locale, page, namespaces = [], children }: { locale: string; page: PageRef; namespaces?: string[]; children: ReactNode }) {
  const machine = locale !== "en" && !allReviewed(locale, pageKeys(page));
  return (
    <I18nProvider messages={clientMessages(locale, namespaces)}>
      <PageAlternates map={alternatesFor(page)} />
      {machine && (
        <div className="container">
          <p className="mt-notice" role="note" data-testid="machine-notice">
            {getT(locale, "common")("lang.machinePage")}
          </p>
        </div>
      )}
      {children}
    </I18nProvider>
  );
}
