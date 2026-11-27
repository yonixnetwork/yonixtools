import { RootDocument } from "@/components/RootDocument";
import { localeFromPrefix } from "@/i18n/locales";
import { rootMetadata, rootViewport } from "@/lib/root-metadata";

/**
 * Root layout for every URL whose first segment is dynamic: English tool pages (/pdf-merger/)
 * and the localized sites (/es/…, /ja/…). The first segment decides the language, so <html lang>
 * and dir are right in the static HTML.
 */
export const metadata = rootMetadata;
export const viewport = rootViewport;

export default async function SlugLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const locale = localeFromPrefix((await params).slug)?.code ?? "en";
  return <RootDocument locale={locale}>{children}</RootDocument>;
}
