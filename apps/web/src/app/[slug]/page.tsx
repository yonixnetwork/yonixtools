import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { allTools, getTool } from "@/lib/registry";
import { builtLocales } from "@/i18n/catalogue";
import { getLocale, localeFromPrefix } from "@/i18n/locales";
import { HomeView, homeMetadata } from "@/views/HomeView";
import { ToolView, toolPageMetadata } from "@/views/ToolView";

/** /<english-tool-slug>/ (English tool pages, unchanged URLs) and /<locale-prefix>/ (localized home pages). */
export const dynamicParams = false;

export function generateStaticParams() {
  return [...allTools.map((t) => ({ slug: t.slug })), ...builtLocales().filter((l) => l !== "en").map((l) => ({ slug: getLocale(l).prefix }))];
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = (await params).slug;
  const loc = localeFromPrefix(slug);
  if (loc) return homeMetadata(loc.code);
  return getTool(slug) ? toolPageMetadata("en", slug) : {};
}

export default async function Page({ params }: Props) {
  const slug = (await params).slug;
  const loc = localeFromPrefix(slug);
  if (loc && builtLocales().includes(loc.code)) return <HomeView locale={loc.code} />;
  if (!getTool(slug)) notFound();
  return <ToolView locale="en" slug={slug} />;
}
